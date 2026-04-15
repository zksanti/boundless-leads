import Anthropic from '@anthropic-ai/sdk'
import type { Lead, Contact } from './types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function generateReport(lead: Lead, contacts: Contact[]): Promise<string> {
  const contactLines = contacts.length
    ? contacts.map((c) => `- ${c.name} (${c.title})${c.linkedin_url ? ` — ${c.linkedin_url}` : ''}`).join('\n')
    : '- No contacts on file'

  const prompt = `You are preparing a call prep brief for a Boundless sales call. Boundless is compliance infrastructure for onchain finance — it lets institutions go onchain without exposing company data (confidential payments, yield, treasury, tokenization on public chains).

COMPANY: ${lead.company_name}
WEBSITE: ${lead.website_url || 'unknown'}
DESCRIPTION: ${lead.description}
QUALIFYING SIGNAL: ${lead.signal}
PRIMARY USE CASE: ${lead.use_case}
COMPANY SIZE: ${lead.company_size || 'unknown'}
FUNDING: ${lead.funding || 'unknown'}
WHY BOUNDLESS FITS: ${lead.why_boundless_fits}

KNOWN CONTACTS:
${contactLines}

Generate a comprehensive call prep brief in clean markdown. Be specific and concrete — no filler. Cover each section below.

---

## Company Overview
What they actually build, their customer base (B2B, B2C, institutional), business model, key differentiators, and any notable traction or scale indicators.

## Blockchain & Compliance Exposure
Which chains/protocols they use or evaluate. Where public transaction visibility creates a problem for them or their clients. Regulatory jurisdictions they operate in (MiCA, FinCEN, FCA, MAS, etc.).

## Recent News & Signals (last 6 months)
Funding rounds, product launches, key hires, partnerships, regulatory filings, executive posts. Flag anything that creates urgency for Boundless.

## Key People
For each known contact and any other decision-makers likely involved in an infrastructure purchase: background, likely role in the buying decision (champion vs. economic buyer vs. blocker), and anything notable from public presence.

## Boundless Fit — Specific Mapping
Map their exact product flow to the specific Boundless service (Boundless Payments / Yield / Treasury / Tokenization). Name the integration point (which API call, which transaction type, which user flow). Quantify the competitive exposure problem if possible.

## Likely Objections & Responses
List the 3-4 most likely objections for this specific company (not generic ones). For each: the objection, why they'd raise it, and the 1-2 sentence response.

## Call Strategy
Recommended opening line. Key talking points in priority order. What to probe for in discovery. When/how to introduce Boundless specifically.

## Discovery Questions
10 sharp questions tailored to this company's specific situation. Mix: qualifying questions (budget, timeline, decision process) with technical/product questions (what they've evaluated, what's blocking them).`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = response.content[0]
  if (content.type !== 'text') return ''
  return content.text
}
