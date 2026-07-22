import Anthropic from '@anthropic-ai/sdk'
import { setupDatabase, getPatterns, getExistingCompanyNames, getActiveRefinements, getActiveICPProfiles, insertLead, insertContact } from './db'
import type { Pattern, Segment, ICPProfile } from './types'
import { SEGMENTS, SEGMENT_KEYS } from './segments'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// Companies the product team has already reached out to (see the outbound
// tracker). Excluded so the tool surfaces net-new leads rather than regenerating
// the existing funnel.
const PIPELINE_EXCLUSIONS = [
  'braintrust', 'galileo', 'patronus ai', 'patronus', 'langwatch', 'giskard',
  'future agi', 'pulse', 'aryn', 'retab', 'evenup', 'supio', 'unsiloed ai',
  'unsiloed', 'extend', 'elicit', 'confident ai', 'deepeval', 'answerthis',
  'docupipe', 'pathnovo', 'applied compute', 'checkstep', 'oumi', 'decoverai',
  'unstract', 'datologyai', 'snorkel ai', 'snorkel', 'layerlens', 'labelbox',
  'arize phoenix', 'arize', 'photoroom', 'unstructured', 'langfuse',
  'kilo code', 'saolaai', 'saola', 'simbian', 'dropzone ai', 'dropzone',
  'fiddler ai', 'fiddler', 'patlytics', 'everlaw', 'comet', 'opik',
  'protege', 'nanonets',
]

function buildPatternContext(patterns: Pattern[]): string {
  const withData = patterns.filter((p) => p.right_swipes + p.left_swipes > 0)
  if (withData.length === 0) return ''

  const lines = withData.map((p) => {
    const total = p.right_swipes + p.left_swipes
    const rate = Math.round((p.right_swipes / total) * 100)
    return `  ${p.use_case} Tier ${p.tier}: ${rate}% approved (${p.right_swipes}/${total})`
  })

  return `\nUSER APPROVAL HISTORY — weight these in your selection:\n${lines.join('\n')}\n`
}

// The three qualification lists come from the living ICP profile when one has
// been accepted for the segment; otherwise from the static segments.ts seed
// (v0). Description, examples, and everything else stay code-owned.
function segmentLists(key: Segment, profile: ICPProfile | undefined) {
  const s = SEGMENTS[key]
  return {
    qualification: profile ? (profile.qualification as string[]) : s.researchQualification,
    exclude: profile ? (profile.exclude as string[]) : s.exclude,
    signals: profile ? (profile.signals as string[]) : s.signals,
    guidance: profile?.guidance ?? '',
  }
}

function buildSegmentBlock(key: Segment, profile: ICPProfile | undefined): string {
  const s = SEGMENTS[key]
  const lists = segmentLists(key, profile)
  return `SEGMENT "${key}" — ${s.label}
${s.description}
Qualification (a lead must plausibly meet these):
${lists.qualification.map((q) => `- ${q}`).join('\n')}
Exclude:
${lists.exclude.map((e) => `- ${e}`).join('\n')}
Known-good examples of the profile (do NOT return these; they calibrate the search): ${s.examples.join(', ')}
High-signal triggers: ${lists.signals.join('; ')}${lists.guidance ? `\nLearned guidance from swipes and prospect conversations: ${lists.guidance}` : ''}`
}

type LeadRow = {
  company_name: string
  website_url: string
  company_linkedin_url?: string
  description: string
  signal: string
  use_case: string
  segment?: string
  tier: number
  company_size: string
  funding: string
  why_boundless_fits: string
  contacts?: Array<{ name: string; title: string; email?: string; linkedin_url: string; twitter_url: string }>
}

// Second-pass gate between model output and the deck: every lead must be a
// real company AND actually fit the ICP + its segment qualification. Only
// leads that pass both reach the swipe deck — swipes confirm the ICP, they
// don't enforce it.
async function vetLeads(leads: LeadRow[], profiles: Record<string, ICPProfile>): Promise<LeadRow[]> {
  if (leads.length === 0) return leads

  const vetPrompt = `You are the quality gate for a customer-discovery lead list. For each company below, judge two things independently and skeptically:

1. "real" — is this a real company you have actually seen in public sources (news, funding announcements, product launches), AND to your knowledge still independent and operating (not acquired, not shut down, not absorbed into a larger company)? false if unsure, possibly fabricated, known to be acquired (e.g. by a cloud provider or enterprise), or known to have shut down.
2. "fits" — does it credibly fit the ICP and its assigned segment? The ICP: Seed to Series B AI-native startups that run or assist in the serving or training of open or custom models and can deploy onto external GPU infrastructure. Segment qualifications:
${SEGMENT_KEYS.map((k) => {
  const lists = segmentLists(k, profiles[k])
  return `   - ${k}: ${lists.qualification.join('; ')}. Excluded: ${lists.exclude.join('; ')}`
}).join('\n')}
   false if the company is too large or too late-stage (well past Series B), is an excluded profile, relies primarily on closed model APIs, or the claimed fit is vague.

Companies:
${leads.map((l, i) => `${i + 1}. ${l.company_name} [segment: ${l.segment || 'unknown'}] — ${l.description || 'no description'} | signal: ${l.signal || 'NONE'} | fit: ${l.why_boundless_fits || 'NONE'}`).join('\n')}

Return ONLY a JSON array, one object per company in the same order: [{"real": true, "fits": false}, ...]`

  try {
    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{ role: 'user', content: vetPrompt }],
    })
    const firstBlock = res.content[0]
    if (firstBlock.type !== 'text') return leads
    const text = firstBlock.text.trim()
    const jsonStr = text.startsWith('[') ? text : (text.match(/\[[\s\S]*\]/) ?? ['[]'])[0]
    const verdicts: Array<{ real?: boolean; fits?: boolean }> = JSON.parse(jsonStr)
    const filtered = leads.filter((_, i) => verdicts[i]?.real !== false && verdicts[i]?.fits !== false)
    const removed = leads.length - filtered.length
    if (removed > 0) console.log(`generate-leads: vetting removed ${removed} leads (hallucinated or off-ICP)`)
    return filtered
  } catch (e) {
    console.warn('generate-leads: vetting pass failed, using unfiltered list', e)
    return leads
  }
}

export async function generateLeads(count = 20, segment?: Segment): Promise<number> {
  // Always ensure schema is current — idempotent, safe to call every time
  await setupDatabase()

  const [patterns, existingNames, refinements, icpProfiles] = await Promise.all([
    getPatterns(),
    getExistingCompanyNames(),
    getActiveRefinements(),
    getActiveICPProfiles(),
  ])

  const patternContext = buildPatternContext(patterns)

  const excluded = [
    ...PIPELINE_EXCLUSIONS,
    ...existingNames,
  ]

  const targetSegments = segment ? [segment] : SEGMENT_KEYS
  const distribution = segment
    ? `All leads must belong to segment "${segment}".`
    : `Distribute leads roughly evenly across the three segments (about ${Math.ceil(count / 3)} each). If one segment cannot be filled with high confidence, return fewer for that segment rather than stretching the qualification.`

  const prompt = `You are a customer-discovery researcher for Boundless. Boundless provides GPUs to companies running AI workloads, such as inference, training, evals, and more. Customers bring their existing model, container, serving, or training stack; Boundless provides the GPU capacity.

We are running a CUSTOMER DISCOVERY EXPERIMENT across three specific segments. The goal is to find teams with a meaningful infrastructure cost or capacity problem so we can learn from them and prove an economic advantage, not to close deals at scale.

ICP (applies to every segment):
Seed to Series B AI-native startups that run or assist in the serving or training of open or custom models, and can deploy their workloads onto external GPU infrastructure (no strict data-sensitivity blockers).
A priority account has 1 or more of:
- Production or recurring GPU demand
- A visible cost or capacity constraint
- Control over their model and infrastructure stack

THE THREE SEGMENTS:

${targetSegments.map((k) => buildSegmentBlock(k, icpProfiles[k])).join('\n\n')}

${distribution}

TIER 1 (prioritize): clearly meets the segment qualification with a named recurring GPU workload and a visible cost/capacity constraint.
TIER 2: plausible fit but one qualification is soft.

CONTACT PRIORITY — this matters as much as the company selection:
For each company, work hard to surface the actual people: founders, CTO, head of infrastructure, ML platform lead. For each person include their name, title, a LinkedIn people-search URL, an X handle if publicly known, and a work email ONLY if it has been published somewhere public (a blog, GitHub, conference page, personal site). NEVER guess or construct email addresses from name patterns; leave the field empty if not publicly known.
If you cannot name any real person for a company, still include the company but make sure website_url and company_linkedin_url are filled in so the team can find contacts manually. A lead with neither named contacts nor a company LinkedIn URL is worth much less.

DO NOT INCLUDE (already contacted or excluded):
${excluded.join(', ')}
${patternContext}${refinements.length > 0 ? `\nUSER SEARCH PREFERENCES (apply these):\n${refinements.map((r) => `  - ${r.content}`).join('\n')}\n` : ''}
CRITICAL — READ BEFORE GENERATING:

You are RECALLING real companies from your training data, not inventing companies that fit a template. Every company you list must be one you have seen in public sources (news articles, funding announcements, job postings, company blogs, product launches). If you are not certain a company exists and matches these criteria, do not include it.

HALLUCINATION RULES — violations make the entire output useless:
- Do NOT invent company names that sound plausible but you have not actually seen in sources
- Do NOT fabricate funding amounts, employee counts, or signals — leave fields blank if unknown
- Do NOT guess contact names or emails — only include people and addresses you have seen publicly associated with the company
- Do NOT include a company if your confidence it exists and fits is below 90%
- If a company fails the ICP or its segment qualification (too large, too late-stage, closed-API-only, excluded profile), OMIT it entirely. NEVER include it with a disclaimer or a note in the description. Every card shown to the user must already match the ICP; the swipe confirms fit, it does not filter misfits.
- Every lead MUST have a non-empty, specific signal and why_boundless_fits. If you cannot state either, the lead does not go on the list.
- It is far better to return 8 real companies than 20 where several are hallucinated or off-ICP

For each company ask yourself: "Have I actually seen this company mentioned in real sources? Can I name a specific GPU-heavy workload they run and a specific reason cost or capacity would hurt them?" If not, skip it.

Return up to ${count} qualified leads (fewer is fine if you cannot reach ${count} with high confidence). Return ONLY a JSON array, no markdown:
[
  {
    "company_name": "string — a real company you have seen in public sources",
    "website_url": "https://... — only include if you are confident of the actual domain. Leave empty string if unsure.",
    "company_linkedin_url": "https://www.linkedin.com/company/<slug> — only if you are confident of the actual company page slug. Leave empty string if unsure.",
    "description": "one sentence on what they build",
    "signal": "the specific real thing that makes them a fit — name the workload and source type (e.g. 'launched batch API per changelog', 'job posting for inference infra engineer', 'founder post on GPU costs'). Do not fabricate signals.",
    "use_case": "evals" | "synth_data" | "agents" | "docs" | "media" | "batch",
    "segment": ${targetSegments.map((s) => `"${s}"`).join(' | ')},
    "tier": 1 | 2,
    "company_size": "only include if you have actually seen this figure. Leave blank if unknown.",
    "funding": "only include if you have seen this figure in a real source. Leave blank if unknown.",
    "why_boundless_fits": "2-3 sentences: name the specific recurring GPU workload they run, why it fits this segment's product hypothesis, and where Boundless capacity would plug in",
    "contacts": [
      {
        "name": "only people you have seen publicly named as founders or executives at this company",
        "title": "their actual known title — prefer founder, CTO, infra/ML-platform lead",
        "email": "work email ONLY if published publicly. Empty string otherwise. Never constructed.",
        "linkedin_url": "LinkedIn people search URL: https://www.linkedin.com/search/results/people/?keywords=FirstName+LastName+CompanyName",
        "twitter_url": "https://x.com/handle — only if you have seen this handle publicly. Empty string if unsure."
      }
    ]
  }
]`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 12000,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = response.content[0]
  if (content.type !== 'text') return 0

  // Log truncation — if this appears in Vercel logs, raise max_tokens further
  if (response.stop_reason === 'max_tokens') {
    console.warn('generate-leads: response was truncated (hit max_tokens). Consider reducing count or fields.')
  }

  let leads: LeadRow[]

  try {
    const text = content.text.trim()
    // Extract JSON array — handles markdown code fences too
    const jsonStr = text.startsWith('[')
      ? text
      : (text.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/) ?? text.match(/(\[[\s\S]*\])/) ?? ['', '[]'])[1]
    leads = JSON.parse(jsonStr)
  } catch (e) {
    console.error('generate-leads: JSON parse failed. stop_reason:', response.stop_reason, 'text length:', content.text.length, e)
    return 0
  }

  // Deterministic gate: a lead the model could not give a concrete signal and
  // fit rationale for is not presentable, regardless of what else it wrote.
  const beforeFieldGate = leads.length
  leads = leads.filter((l) => l.signal?.trim() && l.why_boundless_fits?.trim())
  if (leads.length < beforeFieldGate) {
    console.log(`generate-leads: dropped ${beforeFieldGate - leads.length} leads with empty signal or fit rationale`)
  }

  // Vetting pass — real company AND on-ICP, or it never reaches the deck
  leads = await vetLeads(leads, icpProfiles)

  const validSegments = new Set<string>(SEGMENT_KEYS)

  let inserted = 0
  for (const lead of leads) {
    if (!lead.company_name || !lead.use_case) continue
    if (excluded.includes(lead.company_name.toLowerCase())) continue
    const saved = await insertLead({
      company_name: lead.company_name,
      website_url: lead.website_url || '',
      company_linkedin_url: lead.company_linkedin_url || '',
      description: lead.description || '',
      signal: lead.signal || '',
      use_case: lead.use_case,
      segment: validSegments.has(lead.segment ?? '') ? lead.segment : (segment ?? ''),
      tier: lead.tier || 2,
      company_size: lead.company_size || '',
      funding: lead.funding || '',
      why_boundless_fits: lead.why_boundless_fits || '',
    })

    if (lead.contacts?.length) {
      for (let i = 0; i < lead.contacts.length; i++) {
        const c = lead.contacts[i]
        if (!c.name) continue
        try {
          await insertContact({
            lead_id: saved.id,
            name: c.name,
            title: c.title || '',
            email: c.email || '',
            linkedin_url: c.linkedin_url || '',
            twitter_url: c.twitter_url || '',
            is_primary: i === 0,
          })
        } catch (e) {
          console.warn('insertContact failed (non-fatal):', e)
        }
      }
    }

    inserted++
  }

  return inserted
}
