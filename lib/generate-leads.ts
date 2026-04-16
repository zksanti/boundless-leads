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
Generate ${count} qualified leads. Return ONLY a JSON array, no markdown:
[
  {
    "company_name": "string",
    "website_url": "https://... (homepage URL, best guess if unsure)",
    "description": "one sentence what they do",
    "signal": "specific qualifying signal (product launch, job posting, news, funding round, etc.)",
    "use_case": "payments" | "yield" | "treasury" | "tokenization",
    "tier": 1 | 2,
    "company_size": "e.g. '50-200 employees' or '~500 employees' — estimate if unsure, leave blank if truly unknown",
    "funding": "e.g. 'Series B $45M' or 'Raised $12M seed' or 'Public: NYSE' — leave blank if truly unknown",
    "why_boundless_fits": "2-3 sentences: name the specific Boundless service (Boundless Payments/Yield/Treasury/Tokenization), describe exactly where it plugs into their stack or product flow, and what competitive exposure problem it solves for them specifically",
    "contacts": [
      {
        "name": "string",
        "title": "CEO / Co-founder / CTO / Head of Compliance — pick the most relevant decision-maker",
        "linkedin_url": "LinkedIn people search URL — ALWAYS use this format: https://www.linkedin.com/search/results/people/?keywords=FirstName+LastName+CompanyName (URL-encode spaces as +). Do NOT guess a direct /in/ profile URL — direct URLs will point to the wrong person.",
        "twitter_url": "https://x.com/handle — only include if you are highly confident from public knowledge (e.g. the person has a well-known public Twitter presence). Leave empty string if unsure. Do NOT guess."
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

  let leads: Array<{
    company_name: string
    website_url: string
    description: string
    signal: string
    use_case: string
    tier: number
    company_size: string
    funding: string
    why_boundless_fits: string
    contacts?: Array<{
      name: string
      title: string
      linkedin_url: string
      twitter_url: string
    }>
  }>

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
