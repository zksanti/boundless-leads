import Anthropic from '@anthropic-ai/sdk'
import { setupDatabase, getPatterns, getExistingCompanyNames, getActiveRefinements, insertLead, insertContact } from './db'
import type { Pattern } from './types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const PIPELINE_EXCLUSIONS = [
  'm0', 'xrp ledger', 'stellar', 'anchorage digital', 'wisdomtree',
  'circle', 'nethermind', 'plaid', 'fidelity', 'corpay', 'moneygram',
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

  const prompt = `You are a B2B sales researcher for Boundless, a compliance infrastructure company for onchain finance.

BOUNDLESS CONTEXT:
Category: Compliance infrastructure for onchain finance
Core promise: Go onchain without exposing company data
Services: Boundless Payments, Boundless Treasury, Boundless Yield, Boundless Tokenization
- Boundless Payments: confidential stablecoin payment flows — hides transaction amounts, counterparties, routing
- Boundless Yield: confidential onchain yield deployment — hides protocol allocations, position sizes, yield strategies
- Boundless Treasury: confidential onchain treasury management — hides balance visibility, movement timing
- Boundless Tokenization: compliant tokenized asset issuance with privacy on public chains
Audience: institutions, fintechs, platforms — NOT consumers

ICP — TIER 1 (prioritize):
- Stablecoin platforms with compliance requirements
- Crypto-native fintechs with institutional clients
- Digital asset platforms on public chains
- DeFi protocols adding institutional products
- Neobanks/payment fintechs moving flows onchain

ICP — TIER 2:
- TradFi teams running onchain pilots (asset managers, custodians)
- Cross-border payment processors evaluating stablecoins
- L1/L2 ecosystem partners whose clients need compliance

HIGH URGENCY SIGNALS:
- Just announced a stablecoin product or raised for digital assets
- Hiring "blockchain compliance" or "digital assets compliance" roles
- Recently partnered with a chain or protocol
- CEO/CPO posting about institutional DeFi or stablecoin strategy
- MiCA compliance pressure (EU, CASP deadline July 1, 2026)

DISQUALIFY:
- Pure crypto-native, no institutional user base
- Seed / pre-product
- Building their own private chain
- Consumer-only

DO NOT INCLUDE (already in pipeline):
${excluded.join(', ')}
${patternContext}${refinements.length > 0 ? `\nUSER SEARCH PREFERENCES (apply these):\n${refinements.map((r) => `  - ${r.content}`).join('\n')}\n` : ''}
CRITICAL — READ BEFORE GENERATING:

You are RECALLING real companies from your training data, not inventing companies that fit a template. Every company you list must be one you have seen in public sources (news articles, funding announcements, job postings, company blogs, press releases). If you are not certain a company exists and matches these criteria, do not include it.

HALLUCINATION RULES — violations make the entire output useless:
- Do NOT invent company names that sound plausible but you have not actually seen in sources
- Do NOT fabricate funding amounts, employee counts, or signals — leave fields blank if unknown
- Do NOT guess contact names — only include people you have seen publicly associated with the company (founders named in press, executives in interviews, etc.)
- Do NOT include a company if your confidence it exists and fits is below 90%
- It is far better to return 8 real companies than 20 where several are hallucinated

For each company ask yourself: "Have I actually seen this company mentioned in real sources? Can I name the specific thing that happened — a funding announcement, a product launch, a press release?" If the answer is no, skip it.

Return up to ${count} qualified leads (fewer is fine if you cannot reach ${count} with high confidence). Return ONLY a JSON array, no markdown:
[
  {
    "company_name": "string — a real company you have seen in public sources",
    "website_url": "https://... — only include if you are confident of the actual domain. Leave empty string if unsure.",
    "description": "one sentence what they do",
    "signal": "the specific real event you know about — name the source type (e.g. 'TechCrunch article April 2024', 'job posting on LinkedIn', 'founder tweet'). Do not fabricate signals.",
    "use_case": "payments" | "yield" | "treasury" | "tokenization",
    "tier": 1 | 2,
    "company_size": "only include if you have actually seen this figure. Leave blank if unknown.",
    "funding": "only include if you have seen this figure in a real source. Leave blank if unknown.",
    "why_boundless_fits": "2-3 sentences: name the specific Boundless service, describe where it plugs into their stack, and what exposure problem it solves for them",
    "contacts": [
      {
        "name": "only include people you have seen publicly named as founders or executives at this company",
        "title": "their actual known title",
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
