import Anthropic from '@anthropic-ai/sdk'
import { setupDatabase, getPatterns, getExistingCompanyNames, getActiveRefinements, insertLead, insertContact } from './db'
import type { Pattern } from './types'

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

type LeadRow = {
  company_name: string
  website_url: string
  description: string
  signal: string
  use_case: string
  tier: number
  company_size: string
  funding: string
  why_boundless_fits: string
  contacts?: Array<{ name: string; title: string; linkedin_url: string; twitter_url: string }>
}

async function verifyLeads(leads: LeadRow[]): Promise<LeadRow[]> {
  if (leads.length === 0) return leads

  const names = leads.map((l) => l.company_name)

  const verifyPrompt = `You are a fact-checker reviewing a list of company names. For each company, answer honestly: is this a real company you have actually seen in public sources (news, funding announcements, product launches)? Or does it sound like a plausible name that may have been fabricated?

Companies to check:
${names.map((n, i) => `${i + 1}. ${n}`).join('\n')}

Return ONLY a JSON array of booleans — true if the company is real and you are confident, false if you are unsure or it may be hallucinated. One boolean per company, in the same order. Example: [true, false, true, true]`

  try {
    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      messages: [{ role: 'user', content: verifyPrompt }],
    })
    const firstBlock = res.content[0]
    if (firstBlock.type !== 'text') return leads
    const text = firstBlock.text.trim()
    const jsonStr = text.startsWith('[') ? text : (text.match(/\[[\s\S]*\]/) ?? ['[]'])[0]
    const verified: boolean[] = JSON.parse(jsonStr)
    const filtered = leads.filter((_, i) => verified[i] !== false)
    const removed = leads.length - filtered.length
    if (removed > 0) console.log(`generate-leads: verification removed ${removed} potentially hallucinated companies`)
    return filtered
  } catch (e) {
    console.warn('generate-leads: verification pass failed, using unfiltered list', e)
    return leads
  }
}

export async function generateLeads(count = 20): Promise<number> {
  // Always ensure schema is current — idempotent, safe to call every time
  await setupDatabase()

  const [patterns, existingNames, refinements] = await Promise.all([
    getPatterns(),
    getExistingCompanyNames(),
    getActiveRefinements(),
  ])

  const patternContext = buildPatternContext(patterns)

  const excluded = [
    ...PIPELINE_EXCLUSIONS,
    ...existingNames,
  ]

  const prompt = `You are a customer-discovery researcher for Boundless, which runs a distributed GPU cloud for large-scale, non-latency-critical AI workloads.

BOUNDLESS CONTEXT:
What it is: a distributed GPU cloud built for throughput- and cost-bound AI workloads, not latency-bound ones.
What it runs well today: async and batch inference, eval suites, synthetic data generation, document processing, agent runs, and image/video generation on open and custom models (roughly 8B-70B class).
In scope: workloads that tolerate a queue and low-ish latency (around 500ms time-to-first-token is fine), where cost and throughput matter more than tail latency.
We are doing CUSTOMER DISCOVERY. The goal is to find teams who feel this pain TODAY so we can learn from them, not to close deals.

ICP — THE FIVE PILLARS (a strong lead clears most of these):
1. Runs recurring GPU-heavy workloads: eval suites, release gates, synthetic data, agent runs, document processing, or video/image generation.
2. Feels real pain right now around cost, throughput, queue time, rate limits, or GPU availability.
3. Workload does NOT need ultra-low latency. Low-ish latency, async, and batch jobs are all in scope (~500ms TTFT is fine).
4. The buyer is reachable and pragmatic: founder, CTO, infra lead, ML platform lead, eval lead, or workflow owner at a seed through Series-B-ish team.
5. No hard privacy/compliance blocker that prevents testing external compute right now (this typically excludes healthcare, finance, and large corps — support comes later).

TIER 1 (prioritize): clears all five pillars, with a clearly named recurring GPU workload and an obvious cost/throughput pain.
TIER 2: plausible fit but one pillar is soft (e.g. latency needs are borderline, or the buyer is harder to reach).

HIGH-SIGNAL INDICATORS:
- Public writing/benchmarks about inference cost, GPU spend, or scaling a batch/eval pipeline
- Hiring ML platform / inference infra / eval roles
- Pricing with per-page / per-token / volume tiers (implies high-volume background inference)
- Founder or infra lead posting about GPU availability, rate limits, or cost
- Recently raised and scaling a compute-heavy product

DISQUALIFY:
- Hard privacy/compliance blocker (healthcare, finance, regulated enterprise, government)
- Latency-critical only (real-time chat, sub-second consumer-facing inference) with no async/batch workload
- Large incumbents with locked-in cloud commitments
- Pre-product / no real workload yet

DO NOT INCLUDE (already contacted or excluded):
${excluded.join(', ')}
${patternContext}${refinements.length > 0 ? `\nUSER SEARCH PREFERENCES (apply these):\n${refinements.map((r) => `  - ${r.content}`).join('\n')}\n` : ''}
CRITICAL — READ BEFORE GENERATING:

You are RECALLING real companies from your training data, not inventing companies that fit a template. Every company you list must be one you have seen in public sources (news articles, funding announcements, job postings, company blogs, product launches). If you are not certain a company exists and matches these criteria, do not include it.

HALLUCINATION RULES — violations make the entire output useless:
- Do NOT invent company names that sound plausible but you have not actually seen in sources
- Do NOT fabricate funding amounts, employee counts, or signals — leave fields blank if unknown
- Do NOT guess contact names — only include people you have seen publicly associated with the company (founders named in press, executives in interviews, etc.)
- Do NOT include a company if your confidence it exists and fits is below 90%
- It is far better to return 8 real companies than 20 where several are hallucinated

For each company ask yourself: "Have I actually seen this company mentioned in real sources? Can I name a specific GPU-heavy workload they run and a specific reason cost or throughput would hurt them?" If not, skip it.

Return up to ${count} qualified leads (fewer is fine if you cannot reach ${count} with high confidence). Return ONLY a JSON array, no markdown:
[
  {
    "company_name": "string — a real company you have seen in public sources",
    "website_url": "https://... — only include if you are confident of the actual domain. Leave empty string if unsure.",
    "description": "one sentence on what they build",
    "signal": "the specific real thing that makes them a fit — name the workload and source type (e.g. 'processes 1B+ pages/yr per their pricing page', 'job posting for inference infra engineer', 'founder blog on eval costs'). Do not fabricate signals.",
    "use_case": "evals" | "synth_data" | "agents" | "docs" | "media" | "batch",
    "tier": 1 | 2,
    "company_size": "only include if you have actually seen this figure. Leave blank if unknown.",
    "funding": "only include if you have seen this figure in a real source. Leave blank if unknown.",
    "why_boundless_fits": "2-3 sentences: name the specific recurring GPU workload they run, why it is throughput/cost-bound rather than latency-critical, and where Boundless capacity would plug in",
    "contacts": [
      {
        "name": "only include people you have seen publicly named as founders or executives at this company",
        "title": "their actual known title — prefer founder, CTO, infra/ML-platform lead, or eval lead",
        "linkedin_url": "LinkedIn people search URL: https://www.linkedin.com/search/results/people/?keywords=FirstName+LastName+CompanyName",
        "twitter_url": "https://x.com/handle — only if you have seen this handle publicly. Empty string if unsure."
      }
    ]
  }
]`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 10000,
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

  // Verification pass — ask Claude to flag any hallucinated companies before saving
  leads = await verifyLeads(leads)

  let inserted = 0
  for (const lead of leads) {
    if (!lead.company_name || !lead.use_case) continue
    if (excluded.includes(lead.company_name.toLowerCase())) continue
    const saved = await insertLead({
      company_name: lead.company_name,
      website_url: lead.website_url || '',
      description: lead.description || '',
      signal: lead.signal || '',
      use_case: lead.use_case,
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
