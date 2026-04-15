import Anthropic from '@anthropic-ai/sdk'
import type { Lead, Contact } from './types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// What actually leaks onchain per use case — feeds the "you probably know, but..." bridge
const USE_CASE_EXPOSURE: Record<string, { visible: string; competitive_risk: string }> = {
  payments: {
    visible:
      'stablecoin payment flows expose transaction amounts, recipient wallet addresses, and timing to anyone watching the chain',
    competitive_risk:
      'at scale, that means counterparty relationships, deal sizes, and payment patterns are readable by competitors and analysts',
  },
  yield: {
    visible:
      'onchain yield deployments expose protocol allocations, position sizes, and rotation timing in real-time',
    competitive_risk:
      'competitors and LPs can see exactly where capital is deployed and when it moves, making it trivial to infer strategy or AUM',
  },
  treasury: {
    visible:
      'onchain treasury holdings make wallet balances, incoming transfers, and operational spend publicly readable',
    competitive_risk:
      'anyone who identifies the wallet address can track runway, financial health, and burn rate',
  },
  tokenization: {
    visible:
      'tokenized asset transfers and redemptions are traceable — holder concentration, exit patterns, and secondary market activity all visible',
    competitive_risk:
      'investor composition, redemption behavior, and concentration risk become visible to press and competitors',
  },
}

// Extract first name from a full name string
function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName
}

export interface OutreachResult {
  linkedin_connection: string
  linkedin_dm: string
  email: string
}

export async function generateOutreach(
  lead: Lead,
  contact: Contact | null
): Promise<OutreachResult> {
  const exposure = USE_CASE_EXPOSURE[lead.use_case] ?? USE_CASE_EXPOSURE.payments
  const contactFirstName = contact ? firstName(contact.name) : null
  const contactLine = contact ? `Contact: ${contact.name}, ${contact.title}` : 'No specific contact'

  const prompt = `You write first-touch cold outreach messages on behalf of the Boundless team.

Boundless builds compliance infrastructure for onchain finance. Early partnerships include XRPL and Stellar teams.

COMPANY BEING OUTREACHED:
Company: ${lead.company_name}
What they do: ${lead.description}
Signal (what triggered this — use this for the hook): ${lead.signal}
Use case: ${lead.use_case}
Why relevant: ${lead.why_boundless_fits}
${contactLine}
First name to use in greeting: ${contactFirstName ?? 'none — skip name'}

ONCHAIN EXPOSURE FOR THIS USE CASE:
What leaks: ${exposure.visible}
Competitive risk: ${exposure.competitive_risk}

---

STRUCTURE FOR EMAIL (follow this order exactly):

1. Greeting: "Hey ${contactFirstName ?? '[First Name]'}," — always start here if a first name is available, skip if not
2. Warm hook: One sentence referencing something specific they have done recently — a partnership, a product launch, a hire, a public statement. NEVER quote their funding amount, acquisition price, or valuation back at them. They know those numbers. Reference what they are actively building or shipping.
3. Bridge: Use this framing — "You probably know, but [specific exposure implication]..." — acknowledges they are already in this world, not lecturing them
4. Tie to their situation: One sentence connecting the exposure to their specific product or scale
5. Close: "At Boundless, we are working on [one-line description tied to their use case]. Early partners on XRPL and Stellar have found [relevant benefit]. Curious if [problem] is on your radar?"

STRUCTURE FOR LINKEDIN DM (shorter version):
Same greeting, same hook, shorter bridge, CTA — no need to name Boundless, keep it to an interest check

STRUCTURE FOR CONNECTION NOTE:
One specific observation about what they are building. No pitch. Makes sense as a reason to connect.

---

STRICT RULES:
- EM DASHES ARE BANNED. Every single one. Replace with a comma, period, or rewrite the sentence. If an em dash appears anywhere in your output, the message fails. Use a comma or period instead.
- Do not open with "I" or "We" — open with them
- No hedging: "I believe", "I think", "I would love to", "I wanted to reach out"
- No generic openers: "Hope this finds you well", "I came across your company", "Quick question"
- No stacked punchy sentences ("Private. Compliant. Fast.") — connect ideas into real sentences
- No filler phrases: "compliance layer", "confidentiality layer", "privacy layer", "institutional-grade", "pools", "mandate"
- Do not summarize their company back to them
- One CTA only — an interest check, never a meeting request

EXAMPLES OF THE RIGHT TONE:

--- Email example ---
Hey Sarah,

The Coinbase partnership announcement was a meaningful move, especially for cross-border use cases.

You probably know, but stablecoin payment flows on public chains expose transaction amounts and recipient addresses to anyone watching. At the scale you are heading toward, that means counterparty relationships and deal sizes become readable to competitors and analysts.

At Boundless, we are working on making transaction confidentiality an easy layer for platforms in this space. Early partners on XRPL and Stellar have found real value. Curious if this is on your radar?

--- LinkedIn DM example ---
Hey Sarah,

The Coinbase partnership was a strong signal about where you are taking the product.

One thing that catches teams off guard at that scale: payment amounts and recipient addresses are visible onchain to anyone watching. That starts to matter when deal sizes are real.

Happy to share what a few other platforms have done about this. Interested?

---

Now write three formats for ${lead.company_name}. The hook MUST reference something specific from the signal field above.

Return ONLY valid JSON with no markdown fences:
{
  "linkedin_connection": "connection note under 300 characters",
  "linkedin_dm": "DM under 75 words, three short paragraphs, greeting with first name",
  "email_subject": "2-4 word lowercase subject, no punctuation",
  "email_body": "email under 100 words, follows the five-part structure above"
}`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1200,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = response.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type')

  let result: {
    linkedin_connection: string
    linkedin_dm: string
    email_subject: string
    email_body: string
  }

  try {
    const text = content.text.trim()
    const jsonStr = text.startsWith('{') ? text : (text.match(/\{[\s\S]*\}/) ?? ['{}'])[0]
    result = JSON.parse(jsonStr)
  } catch {
    throw new Error('Could not parse outreach response')
  }

  // Post-process: strip any em dashes that slipped through
  const stripEmDash = (s: string) => s.replace(/\s*—\s*/g, ', ')

  return {
    linkedin_connection: stripEmDash(result.linkedin_connection || ''),
    linkedin_dm: stripEmDash(result.linkedin_dm || ''),
    email: stripEmDash(`Subject: ${result.email_subject || ''}\n\n${result.email_body || ''}`),
  }
}
