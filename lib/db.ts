import { neon } from '@neondatabase/serverless'
import type { Lead, Contact, Pattern, Outreach, LeadWithContacts, CRMStage, PatternInsight, SearchRefinement } from './types'

const sql = neon(process.env.POSTGRES_URL!)

export async function setupDatabase() {
  await sql`
    CREATE TABLE IF NOT EXISTS leads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_name TEXT NOT NULL,
      website_url TEXT DEFAULT '',
      description TEXT DEFAULT '',
      signal TEXT DEFAULT '',
      use_case TEXT NOT NULL DEFAULT 'payments',
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

  const useCases = ['payments', 'yield', 'treasury', 'tokenization']
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
  tier: number
  company_size: string
  funding: string
  why_boundless_fits: string
}): Promise<Lead> {
  const rows = await sql`
    INSERT INTO leads (company_name, website_url, description, signal, use_case, tier, company_size, funding, why_boundless_fits)
    VALUES (${lead.company_name}, ${lead.website_url}, ${lead.description}, ${lead.signal}, ${lead.use_case}, ${lead.tier}, ${lead.company_size}, ${lead.funding}, ${lead.why_boundless_fits})
    RETURNING *
  `
  return rows[0] as Lead
}

export async function insertContact(contact: {
  lead_id: string
  name: string
  title: string
  linkedin_url: string
  twitter_url?: string
  is_primary: boolean
}): Promise<Contact> {
  const rows = await sql`
    INSERT INTO contacts (lead_id, name, title, linkedin_url, twitter_url, is_primary)
    VALUES (${contact.lead_id}, ${contact.name}, ${contact.title}, ${contact.linkedin_url}, ${contact.twitter_url ?? ''}, ${contact.is_primary})
    RETURNING *
  `
  return rows[0] as Contact
}

export async function updateCRMStage(leadId: string, stage: CRMStage): Promise<void> {
  await sql`UPDATE leads SET crm_stage = ${stage} WHERE id = ${leadId}`
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
  type: 'linkedin_connection' | 'linkedin_dm' | 'email' | 'research_report'
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

export async function deletePendingLeads(): Promise<number> {
  const rows = await sql`
    DELETE FROM leads WHERE status = 'pending' OR status = 'snoozed'
    RETURNING id
  `
  return rows.length
}
