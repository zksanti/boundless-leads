import { neon } from '@neondatabase/serverless'
import type { Lead, Contact, Pattern, Outreach, LeadWithContacts, CRMStage, OutreachChannel, PatternInsight, SearchRefinement, Conversation, ConversationAnalysis, ValidationRecord, Learning, ICPProfile, Segment } from './types'

const sql = neon(process.env.POSTGRES_URL!)

export async function setupDatabase() {
  await sql`
    CREATE TABLE IF NOT EXISTS leads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_name TEXT NOT NULL,
      website_url TEXT DEFAULT '',
      description TEXT DEFAULT '',
      signal TEXT DEFAULT '',
      use_case TEXT NOT NULL DEFAULT 'batch',
      tier INTEGER NOT NULL DEFAULT 2,
      company_size TEXT DEFAULT '',
      funding TEXT DEFAULT '',
      why_boundless_fits TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      swiped_at TIMESTAMPTZ,
      snooze_until TIMESTAMPTZ
    )
  `

  // Migrate existing tables safely
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS website_url TEXT DEFAULT ''`
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS company_size TEXT DEFAULT ''`
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS funding TEXT DEFAULT ''`
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS crm_stage TEXT NOT NULL DEFAULT 'needs_outreach'`
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_priority BOOLEAN NOT NULL DEFAULT FALSE`
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS outreach_channel TEXT DEFAULT NULL`
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS outreach_sent_at TIMESTAMPTZ DEFAULT NULL`
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS segment TEXT NOT NULL DEFAULT ''`
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS company_linkedin_url TEXT DEFAULT ''`

  await sql`
    CREATE TABLE IF NOT EXISTS contacts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      title TEXT DEFAULT '',
      linkedin_url TEXT DEFAULT '',
      twitter_url TEXT DEFAULT '',
      is_primary BOOLEAN DEFAULT FALSE
    )
  `
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS twitter_url TEXT DEFAULT ''`
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS email TEXT DEFAULT ''`

  await sql`
    CREATE TABLE IF NOT EXISTS swipe_patterns (
      use_case TEXT NOT NULL,
      tier INTEGER NOT NULL,
      right_swipes INTEGER DEFAULT 0,
      left_swipes INTEGER DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (use_case, tier)
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS outreach (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
      contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      generated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS pattern_insights (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      swipe_milestone INTEGER NOT NULL,
      insight TEXT NOT NULL,
      refinement TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      user_feedback TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      responded_at TIMESTAMPTZ
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS search_refinements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      content TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'ai',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      active BOOLEAN NOT NULL DEFAULT TRUE
    )
  `

  // Conversation ingestion + living ICP (July 2026). All additive — the DB is
  // shared with the live Vercel deployment.
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS rejection_reason TEXT DEFAULT ''`
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS validation JSONB DEFAULT NULL`

  await sql`
    CREATE TABLE IF NOT EXISTS conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      content TEXT NOT NULL,
      occurred_at TIMESTAMPTZ DEFAULT NOW(),
      primary_tag TEXT DEFAULT '',
      secondary_tag TEXT DEFAULT '',
      analysis JSONB DEFAULT NULL,
      analyzed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS learnings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      category TEXT NOT NULL,
      segment TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'conversation',
      conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
      lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      auto_applied BOOLEAN NOT NULL DEFAULT FALSE,
      user_feedback TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      responded_at TIMESTAMPTZ
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS icp_profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      segment TEXT NOT NULL,
      version INTEGER NOT NULL,
      qualification JSONB NOT NULL DEFAULT '[]',
      exclude JSONB NOT NULL DEFAULT '[]',
      signals JSONB NOT NULL DEFAULT '[]',
      guidance TEXT NOT NULL DEFAULT '',
      change_summary TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      source_counts JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      responded_at TIMESTAMPTZ,
      UNIQUE (segment, version)
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `

  const useCases = ['evals', 'synth_data', 'agents', 'docs', 'media', 'batch']
  for (const uc of useCases) {
    for (const tier of [1, 2]) {
      await sql`
        INSERT INTO swipe_patterns (use_case, tier, right_swipes, left_swipes)
        VALUES (${uc}, ${tier}, 0, 0)
        ON CONFLICT (use_case, tier) DO NOTHING
      `
    }
  }
}

export async function getPendingLeads(limit = 10): Promise<Lead[]> {
  const rows = await sql`
    SELECT * FROM leads
    WHERE status = 'pending'
       OR (status = 'snoozed' AND snooze_until < NOW())
    ORDER BY is_priority DESC, created_at DESC
    LIMIT ${limit}
  `
  return rows as Lead[]
}

export async function getPendingLeadCount(): Promise<number> {
  const rows = await sql`
    SELECT COUNT(*)::int AS count FROM leads
    WHERE status = 'pending'
  `
  return rows[0].count
}

export async function getAcceptedLeads(): Promise<LeadWithContacts[]> {
  const leads = await sql`
    SELECT * FROM leads WHERE status = 'accepted'
    ORDER BY is_priority DESC, swiped_at DESC
  `

  return Promise.all(
    (leads as Lead[]).map(async (lead) => {
      const contacts = await sql`
        SELECT * FROM contacts WHERE lead_id = ${lead.id}
        ORDER BY is_primary DESC
      `
      const outreach = await sql`
        SELECT * FROM outreach WHERE lead_id = ${lead.id}
        ORDER BY generated_at DESC
      `
      return { ...lead, contacts: contacts as Contact[], outreach: outreach as Outreach[] }
    })
  )
}

export async function recordSwipe(leadId: string, direction: 'right' | 'left' | 'down') {
  if (direction === 'down') {
    await sql`
      UPDATE leads
      SET status = 'snoozed', swiped_at = NOW(), snooze_until = NOW() + INTERVAL '7 days'
      WHERE id = ${leadId}
    `
    return
  }

  const status = direction === 'right' ? 'accepted' : 'rejected'
  await sql`
    UPDATE leads SET status = ${status}, swiped_at = NOW()
    WHERE id = ${leadId}
  `

  const rows = await sql`SELECT use_case, tier FROM leads WHERE id = ${leadId}`
  if (!rows[0]) return

  const { use_case, tier } = rows[0]
  if (direction === 'right') {
    await sql`
      UPDATE swipe_patterns
      SET right_swipes = right_swipes + 1, updated_at = NOW()
      WHERE use_case = ${use_case} AND tier = ${tier}
    `
  } else {
    await sql`
      UPDATE swipe_patterns
      SET left_swipes = left_swipes + 1, updated_at = NOW()
      WHERE use_case = ${use_case} AND tier = ${tier}
    `
  }
}

export async function getPatterns(): Promise<Pattern[]> {
  const rows = await sql`
    SELECT * FROM swipe_patterns ORDER BY use_case, tier
  `
  return rows as Pattern[]
}

export async function getTotalSwipeCount(): Promise<number> {
  const rows = await sql`
    SELECT COUNT(*)::int AS count FROM leads
    WHERE status IN ('accepted', 'rejected')
  `
  return rows[0].count
}

export async function getSwipedLeadsForAnalysis(): Promise<{ accepted: Lead[]; rejected: Lead[] }> {
  const accepted = await sql`
    SELECT id, company_name, use_case, tier, description, signal, why_boundless_fits, funding, company_size
    FROM leads WHERE status = 'accepted'
    ORDER BY swiped_at DESC LIMIT 60
  `
  const rejected = await sql`
    SELECT id, company_name, use_case, tier, description, signal, why_boundless_fits, funding, company_size
    FROM leads WHERE status = 'rejected'
    ORDER BY swiped_at DESC LIMIT 60
  `
  return { accepted: accepted as Lead[], rejected: rejected as Lead[] }
}

export async function getPendingInsight(): Promise<PatternInsight | null> {
  const rows = await sql`
    SELECT * FROM pattern_insights WHERE status = 'pending'
    ORDER BY created_at DESC LIMIT 1
  `
  return (rows[0] as PatternInsight) || null
}

export async function getInsightForMilestone(milestone: number): Promise<PatternInsight | null> {
  const rows = await sql`
    SELECT * FROM pattern_insights WHERE swipe_milestone = ${milestone}
    ORDER BY created_at DESC LIMIT 1
  `
  return (rows[0] as PatternInsight) || null
}

export async function saveInsight(milestone: number, insight: string, refinement: string): Promise<PatternInsight> {
  const rows = await sql`
    INSERT INTO pattern_insights (swipe_milestone, insight, refinement)
    VALUES (${milestone}, ${insight}, ${refinement})
    RETURNING *
  `
  return rows[0] as PatternInsight
}

export async function respondToInsight(id: string, status: 'accepted' | 'rejected', feedback: string): Promise<void> {
  await sql`
    UPDATE pattern_insights
    SET status = ${status}, user_feedback = ${feedback}, responded_at = NOW()
    WHERE id = ${id}
  `
}

export async function getActiveRefinements(): Promise<SearchRefinement[]> {
  const rows = await sql`
    SELECT * FROM search_refinements WHERE active = TRUE
    ORDER BY created_at DESC
  `
  return rows as SearchRefinement[]
}

export async function saveRefinement(content: string, source: 'ai' | 'manual'): Promise<SearchRefinement> {
  const rows = await sql`
    INSERT INTO search_refinements (content, source)
    VALUES (${content}, ${source})
    RETURNING *
  `
  return rows[0] as SearchRefinement
}

export async function deactivateRefinement(id: string): Promise<void> {
  await sql`UPDATE search_refinements SET active = FALSE WHERE id = ${id}`
}

export async function insertLead(lead: {
  company_name: string
  website_url: string
  description: string
  signal: string
  use_case: string
  segment?: string
  company_linkedin_url?: string
  tier: number
  company_size: string
  funding: string
  why_boundless_fits: string
}): Promise<Lead> {
  const rows = await sql`
    INSERT INTO leads (company_name, website_url, description, signal, use_case, segment, company_linkedin_url, tier, company_size, funding, why_boundless_fits)
    VALUES (${lead.company_name}, ${lead.website_url}, ${lead.description}, ${lead.signal}, ${lead.use_case}, ${lead.segment ?? ''}, ${lead.company_linkedin_url ?? ''}, ${lead.tier}, ${lead.company_size}, ${lead.funding}, ${lead.why_boundless_fits})
    RETURNING *
  `
  return rows[0] as Lead
}

export async function insertContact(contact: {
  lead_id: string
  name: string
  title: string
  email?: string
  linkedin_url: string
  twitter_url?: string
  is_primary: boolean
}): Promise<Contact> {
  const rows = await sql`
    INSERT INTO contacts (lead_id, name, title, email, linkedin_url, twitter_url, is_primary)
    VALUES (${contact.lead_id}, ${contact.name}, ${contact.title}, ${contact.email ?? ''}, ${contact.linkedin_url}, ${contact.twitter_url ?? ''}, ${contact.is_primary})
    RETURNING *
  `
  return rows[0] as Contact
}

export async function updateCRMStage(leadId: string, stage: CRMStage): Promise<void> {
  if (stage === 'outreach_sent') {
    await sql`UPDATE leads SET crm_stage = ${stage}, outreach_sent_at = NOW() WHERE id = ${leadId}`
  } else {
    await sql`UPDATE leads SET crm_stage = ${stage} WHERE id = ${leadId}`
  }
}

export async function setOutreachChannel(leadId: string, channel: OutreachChannel): Promise<void> {
  await sql`UPDATE leads SET outreach_channel = ${channel} WHERE id = ${leadId}`
}

export async function updateSegment(leadId: string, segment: string): Promise<void> {
  await sql`UPDATE leads SET segment = ${segment} WHERE id = ${leadId}`
}

// Manually-added pipeline entry: skips the swipe deck entirely and lands
// directly in the CRM as an accepted lead in needs_outreach.
export async function createManualLead(lead: {
  company_name: string
  website_url: string
  company_linkedin_url: string
  description: string
  signal: string
  use_case: string
  segment: string
  tier: number
  company_size: string
  funding: string
  why_boundless_fits: string
}): Promise<Lead> {
  const rows = await sql`
    INSERT INTO leads (company_name, website_url, company_linkedin_url, description, signal, use_case, segment, tier, company_size, funding, why_boundless_fits, status, crm_stage, swiped_at)
    VALUES (${lead.company_name}, ${lead.website_url}, ${lead.company_linkedin_url}, ${lead.description}, ${lead.signal}, ${lead.use_case}, ${lead.segment}, ${lead.tier}, ${lead.company_size}, ${lead.funding}, ${lead.why_boundless_fits}, 'accepted', 'needs_outreach', NOW())
    RETURNING *
  `
  return rows[0] as Lead
}

export async function saveSentMessage(leadId: string, content: string): Promise<Outreach> {
  const rows = await sql`
    INSERT INTO outreach (lead_id, contact_id, type, content)
    VALUES (${leadId}, NULL, 'sent_message', ${content})
    RETURNING *
  `
  return rows[0] as Outreach
}

export async function autoMoveExpiredOutreach(): Promise<number> {
  const rows = await sql`
    UPDATE leads
    SET crm_stage = 'follow_up_due'
    WHERE crm_stage = 'outreach_sent'
      AND outreach_sent_at IS NOT NULL
      AND outreach_sent_at < NOW() - INTERVAL '72 hours'
    RETURNING id
  `
  return rows.length
}

export async function togglePriority(leadId: string): Promise<boolean> {
  const rows = await sql`
    UPDATE leads SET is_priority = NOT is_priority WHERE id = ${leadId}
    RETURNING is_priority
  `
  return rows[0].is_priority as boolean
}

export async function getReportForLead(leadId: string): Promise<Outreach | null> {
  const rows = await sql`
    SELECT * FROM outreach
    WHERE lead_id = ${leadId} AND type = 'research_report'
    ORDER BY generated_at DESC
    LIMIT 1
  `
  return (rows[0] as Outreach) || null
}

export async function insertOutreach(outreach: {
  lead_id: string
  contact_id: string | null
  type: 'linkedin_connection' | 'linkedin_dm' | 'email' | 'x_dm' | 'research_report'
  content: string
}): Promise<Outreach> {
  const rows = await sql`
    INSERT INTO outreach (lead_id, contact_id, type, content)
    VALUES (${outreach.lead_id}, ${outreach.contact_id}, ${outreach.type}, ${outreach.content})
    RETURNING *
  `
  return rows[0] as Outreach
}

export async function getExistingCompanyNames(): Promise<string[]> {
  const rows = await sql`
    SELECT LOWER(company_name) AS name FROM leads
    WHERE status IN ('accepted', 'pending', 'snoozed')
  `
  return rows.map((r) => r.name as string)
}

export async function getLeadById(id: string): Promise<Lead | null> {
  const rows = await sql`SELECT * FROM leads WHERE id = ${id}`
  return (rows[0] as Lead) || null
}

export async function getContactById(id: string): Promise<Contact | null> {
  const rows = await sql`SELECT * FROM contacts WHERE id = ${id}`
  return (rows[0] as Contact) || null
}

export async function updateContact(id: string, fields: {
  name?: string
  title?: string
  email?: string
  linkedin_url?: string
  twitter_url?: string
}): Promise<Contact> {
  const rows = await sql`
    UPDATE contacts
    SET
      name         = COALESCE(${fields.name         ?? null}, name),
      title        = COALESCE(${fields.title        ?? null}, title),
      email        = COALESCE(${fields.email        ?? null}, email),
      linkedin_url = COALESCE(${fields.linkedin_url ?? null}, linkedin_url),
      twitter_url  = COALESCE(${fields.twitter_url  ?? null}, twitter_url)
    WHERE id = ${id}
    RETURNING *
  `
  return rows[0] as Contact
}

export async function deletePendingLeads(): Promise<number> {
  const rows = await sql`
    DELETE FROM leads WHERE status = 'pending' OR status = 'snoozed'
    RETURNING id
  `
  return rows.length
}

// ─── Settings ───────────────────────────────────────────────────────────────

export async function getSetting(key: string): Promise<string | null> {
  const rows = await sql`SELECT value FROM app_settings WHERE key = ${key}`
  return (rows[0]?.value as string) ?? null
}

export async function setSetting(key: string, value: string): Promise<void> {
  await sql`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (${key}, ${value}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = ${value}, updated_at = NOW()
  `
}

// ─── Rejection reasons ──────────────────────────────────────────────────────

export async function saveRejectionReason(leadId: string, reason: string): Promise<void> {
  await sql`
    UPDATE leads SET rejection_reason = ${reason}
    WHERE id = ${leadId} AND status = 'rejected'
  `
}

// ─── Conversations + validation ─────────────────────────────────────────────

export async function insertConversation(conv: {
  lead_id: string
  kind: string
  content: string
  occurred_at?: string
}): Promise<Conversation> {
  const rows = await sql`
    INSERT INTO conversations (lead_id, kind, content, occurred_at)
    VALUES (${conv.lead_id}, ${conv.kind}, ${conv.content}, ${conv.occurred_at ?? new Date().toISOString()})
    RETURNING *
  `
  return rows[0] as Conversation
}

export async function updateConversationAnalysis(
  id: string,
  primaryTag: string,
  secondaryTag: string,
  analysis: ConversationAnalysis
): Promise<void> {
  await sql`
    UPDATE conversations
    SET primary_tag = ${primaryTag}, secondary_tag = ${secondaryTag},
        analysis = ${JSON.stringify(analysis)}::jsonb, analyzed_at = NOW()
    WHERE id = ${id}
  `
}

export async function getConversationsForLead(leadId: string): Promise<Conversation[]> {
  const rows = await sql`
    SELECT * FROM conversations WHERE lead_id = ${leadId}
    ORDER BY occurred_at DESC
  `
  return rows as Conversation[]
}

export async function deleteConversation(id: string): Promise<void> {
  await sql`DELETE FROM conversations WHERE id = ${id}`
}

export async function updateLeadValidation(leadId: string, validation: ValidationRecord): Promise<void> {
  await sql`
    UPDATE leads SET validation = ${JSON.stringify(validation)}::jsonb
    WHERE id = ${leadId}
  `
}

// ─── Learnings ──────────────────────────────────────────────────────────────

export async function insertLearning(learning: {
  category: 'icp' | 'messaging'
  segment: string
  content: string
  source: 'conversation' | 'manual'
  conversation_id?: string | null
  lead_id?: string | null
  status?: 'pending' | 'accepted'
  auto_applied?: boolean
}): Promise<Learning> {
  const rows = await sql`
    INSERT INTO learnings (category, segment, content, source, conversation_id, lead_id, status, auto_applied, responded_at)
    VALUES (
      ${learning.category}, ${learning.segment}, ${learning.content}, ${learning.source},
      ${learning.conversation_id ?? null}, ${learning.lead_id ?? null},
      ${learning.status ?? 'pending'}, ${learning.auto_applied ?? false},
      ${learning.status === 'accepted' ? new Date().toISOString() : null}
    )
    RETURNING *
  `
  return rows[0] as Learning
}

export async function getLearnings(filter: {
  status?: 'pending' | 'accepted' | 'rejected'
  category?: 'icp' | 'messaging'
} = {}): Promise<Learning[]> {
  const rows = await sql`
    SELECT * FROM learnings
    WHERE (${filter.status ?? null}::text IS NULL OR status = ${filter.status ?? null})
      AND (${filter.category ?? null}::text IS NULL OR category = ${filter.category ?? null})
    ORDER BY created_at DESC
  `
  return rows as Learning[]
}

export async function respondToLearning(id: string, status: 'accepted' | 'rejected', feedback: string): Promise<void> {
  await sql`
    UPDATE learnings
    SET status = ${status}, user_feedback = ${feedback}, responded_at = NOW()
    WHERE id = ${id}
  `
}

// Accepted learnings for a segment, plus global ones ('' segment). Capped so
// prompt injection blocks stay bounded.
export async function getAcceptedLearnings(category: 'icp' | 'messaging', segment: string): Promise<Learning[]> {
  const rows = await sql`
    SELECT * FROM learnings
    WHERE status = 'accepted' AND category = ${category}
      AND (segment = ${segment} OR segment = '')
    ORDER BY created_at DESC
    LIMIT 10
  `
  return rows as Learning[]
}

// Tag counts per segment for the funnel-diagnosis strip.
export async function getResponseTagAggregates(): Promise<Array<{ segment: string; primary_tag: string; count: number }>> {
  const rows = await sql`
    SELECT l.segment, c.primary_tag, COUNT(*)::int AS count
    FROM conversations c
    JOIN leads l ON l.id = c.lead_id
    WHERE c.primary_tag != ''
    GROUP BY l.segment, c.primary_tag
  `
  return rows as Array<{ segment: string; primary_tag: string; count: number }>
}

// ─── ICP profiles ───────────────────────────────────────────────────────────

export async function getActiveICPProfile(segment: string): Promise<ICPProfile | null> {
  const rows = await sql`
    SELECT * FROM icp_profiles WHERE segment = ${segment} AND status = 'active'
    ORDER BY version DESC LIMIT 1
  `
  return (rows[0] as ICPProfile) || null
}

export async function getActiveICPProfiles(): Promise<Record<string, ICPProfile>> {
  const rows = await sql`SELECT * FROM icp_profiles WHERE status = 'active'`
  const map: Record<string, ICPProfile> = {}
  for (const row of rows as ICPProfile[]) map[row.segment] = row
  return map
}

export async function getICPProfilesBySegment(): Promise<Record<string, ICPProfile[]>> {
  const rows = await sql`SELECT * FROM icp_profiles ORDER BY segment, version DESC`
  const map: Record<string, ICPProfile[]> = {}
  for (const row of rows as ICPProfile[]) {
    ;(map[row.segment] ??= []).push(row)
  }
  return map
}

export async function getPendingICPProfile(segment: string): Promise<ICPProfile | null> {
  const rows = await sql`
    SELECT * FROM icp_profiles WHERE segment = ${segment} AND status = 'pending'
    ORDER BY version DESC LIMIT 1
  `
  return (rows[0] as ICPProfile) || null
}

export async function saveICPProfileDraft(
  segment: string,
  draft: {
    qualification: string[]
    exclude: string[]
    signals: string[]
    guidance: string
    change_summary: string
    source_counts: Record<string, number>
  }
): Promise<ICPProfile> {
  const rows = await sql`
    INSERT INTO icp_profiles (segment, version, qualification, exclude, signals, guidance, change_summary, source_counts)
    VALUES (
      ${segment},
      (SELECT COALESCE(MAX(version), 0) + 1 FROM icp_profiles WHERE segment = ${segment}),
      ${JSON.stringify(draft.qualification)}::jsonb,
      ${JSON.stringify(draft.exclude)}::jsonb,
      ${JSON.stringify(draft.signals)}::jsonb,
      ${draft.guidance}, ${draft.change_summary},
      ${JSON.stringify(draft.source_counts)}::jsonb
    )
    RETURNING *
  `
  return rows[0] as ICPProfile
}

export async function getICPProfileById(id: string): Promise<ICPProfile | null> {
  const rows = await sql`SELECT * FROM icp_profiles WHERE id = ${id}`
  return (rows[0] as ICPProfile) || null
}

export async function respondToICPProfile(id: string, status: 'accepted' | 'rejected'): Promise<void> {
  if (status === 'accepted') {
    const rows = await sql`SELECT segment FROM icp_profiles WHERE id = ${id}`
    if (!rows[0]) return
    await sql`
      UPDATE icp_profiles SET status = 'superseded', responded_at = NOW()
      WHERE segment = ${rows[0].segment} AND status = 'active'
    `
    await sql`UPDATE icp_profiles SET status = 'active', responded_at = NOW() WHERE id = ${id}`
  } else {
    await sql`UPDATE icp_profiles SET status = 'rejected', responded_at = NOW() WHERE id = ${id}`
  }
}

// ─── Learning-event inputs for ICP synthesis ────────────────────────────────

export async function getSegmentSwipeStats(segment: string): Promise<Array<{
  use_case: string
  tier: number
  accepted: number
  rejected: number
}>> {
  const rows = await sql`
    SELECT use_case, tier,
      COUNT(*) FILTER (WHERE status = 'accepted')::int AS accepted,
      COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected
    FROM leads
    WHERE segment = ${segment} AND status IN ('accepted', 'rejected')
    GROUP BY use_case, tier
    ORDER BY use_case, tier
  `
  return rows as Array<{ use_case: string; tier: number; accepted: number; rejected: number }>
}

export async function getSegmentSwipedLeads(segment: string): Promise<{ accepted: Lead[]; rejected: Lead[] }> {
  const accepted = await sql`
    SELECT id, company_name, use_case, tier, description, signal, why_boundless_fits, rejection_reason
    FROM leads WHERE segment = ${segment} AND status = 'accepted'
    ORDER BY swiped_at DESC LIMIT 40
  `
  const rejected = await sql`
    SELECT id, company_name, use_case, tier, description, signal, why_boundless_fits, rejection_reason
    FROM leads WHERE segment = ${segment} AND status = 'rejected'
    ORDER BY swiped_at DESC LIMIT 40
  `
  return { accepted: accepted as Lead[], rejected: rejected as Lead[] }
}

// New learning signals for a segment since its current active profile was
// created (or all-time when no profile exists). Powers the "N new signals
// since vX" nudge on the Learnings page.
export async function getLearningEventCounts(segment: Segment): Promise<{
  swipes: number
  rejection_reasons: number
  learnings: number
  tags: number
}> {
  const active = await getActiveICPProfile(segment)
  const since = active?.created_at ?? '1970-01-01'
  const swipes = await sql`
    SELECT COUNT(*)::int AS count FROM leads
    WHERE segment = ${segment} AND status IN ('accepted', 'rejected') AND swiped_at > ${since}
  `
  const reasons = await sql`
    SELECT COUNT(*)::int AS count FROM leads
    WHERE segment = ${segment} AND rejection_reason != '' AND swiped_at > ${since}
  `
  const learnings = await sql`
    SELECT COUNT(*)::int AS count FROM learnings
    WHERE category = 'icp' AND status = 'accepted'
      AND (segment = ${segment} OR segment = '') AND created_at > ${since}
  `
  const tags = await sql`
    SELECT COUNT(*)::int AS count FROM conversations c
    JOIN leads l ON l.id = c.lead_id
    WHERE l.segment = ${segment} AND c.primary_tag != '' AND c.created_at > ${since}
  `
  return {
    swipes: swipes[0].count,
    rejection_reasons: reasons[0].count,
    learnings: learnings[0].count,
    tags: tags[0].count,
  }
}

// Hard reset: clears every lead (contacts + outreach cascade), the learned
// swipe patterns, AI insights, and search refinements, then reseeds the empty
// pattern grid for the current workload taxonomy. Used when repointing the tool
// at a new product/ICP. Returns the number of leads removed.
export async function wipeDatabase(): Promise<number> {
  await setupDatabase()
  const removed = await sql`DELETE FROM leads RETURNING id`
  await sql`DELETE FROM pattern_insights`
  await sql`DELETE FROM search_refinements`
  await sql`DELETE FROM learnings`
  await sql`DELETE FROM conversations`
  await sql`DELETE FROM icp_profiles`
  await sql`DELETE FROM swipe_patterns`

  const useCases = ['evals', 'synth_data', 'agents', 'docs', 'media', 'batch']
  for (const uc of useCases) {
    for (const tier of [1, 2]) {
      await sql`
        INSERT INTO swipe_patterns (use_case, tier, right_swipes, left_swipes)
        VALUES (${uc}, ${tier}, 0, 0)
        ON CONFLICT (use_case, tier) DO NOTHING
      `
    }
  }
  return removed.length
}
