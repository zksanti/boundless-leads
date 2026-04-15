import Anthropic from '@anthropic-ai/sdk'
import type { Lead, Contact } from './types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// What actually leaks onchain per use case — the specific exposure bridge
const USE_CASE_EXPOSURE: Record<string, { visible: string; competitive_risk: string }> = {
  payments: {
    visible:
      'stablecoin payment flows on public chains expose transaction amounts, recipient wallet addresses, and timing — all of it readable by anyone',
    competitive_risk:
      'at volume, that means supplier relationships, deal sizes, and customer payment patterns are visible to competitors, analysts, and anyone else watching',
  },
  yield: {
    visible:
      'onchain yield deployments expose protocol allocations, position sizes, and rotation timing in real-time',
    competitive_risk:
      'competitors and LPs can see exactly where capital is deployed, how much, and when it moves — making it trivial to front-run strategy or infer AUM',
  },
  treasury: {
    visible:
      'onchain treasury holdings make wallet balances, incoming transfers (including fundraising), and operational spend publicly readable',
    competitive_risk:
      'anyone who identifies the wallet address can track runway, financial health, and burn rate — including journalists, competitors, and prospective hires',
  },
  tokenization: {
    visible:
      'tokenized asset transfers and redemptions are traceable — holder concentration, exit patterns, and secondary market activity all on-chain',
    competitive_risk:
      'investor composition, redemption behavior, and concentration risk become visible to press and competitors, undermining fund confidentiality',
  },
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
  const contactLine = contact ? `Contact: ${contact.name}, ${contact.title}` : ''

  const prompt = `You write first-touch cold outreach messages. The sender works in compliance infrastructure for onchain finance — they have seen how public blockchain activity creates competitive exposure for fintechs and financial platforms, and they help companies solve it.

COMPANY BEING OUTREACHED:
Company: ${lead.company_name}
What they do: ${lead.description}
Signal (what triggered this outreach — use this for the specific hook): ${lead.signal}
Use case category: ${lead.use_case}
Why this is relevant for them: ${lead.why_boundless_fits}
${contactLine}

ONCHAIN EXPOSURE CONTEXT FOR THIS USE CASE:
What becomes visible: ${exposure.visible}
The competitive risk: ${exposure.competitive_risk}

WRITING RULES:
- NEVER name the product or company in the first message — it enters in email 2 only
- Open with THEM: a specific observation about what they're building or announced
- Do not open with "I" or "We"
- Under 75 words for email body. Under 70 words for DM. Under 300 characters for connection note.
- One CTA only — an interest check ("Worth a look?" / "Curious if this is on your radar?"), never a meeting ask
- Write like someone who has worked on this problem before, not a vendor pitching
- No em dashes. No hedging language ("I believe", "I think", "I'd love to")
- Subject lines: 2-4 words, lowercase, no punctuation — should read like an internal message
- Connect related ideas into full sentences — never stack short punchy sentences ("Private. Compliant. Fast." is not acceptable prose)

DO NOT WRITE:
- Generic openers: "Hope this finds you well", "I came across your company", "Quick question for you"
- Summarize their company back to them (they know what they do)
- Describe how the compliance product works
- Use any of these phrases: "compliance layer", "confidentiality layer", "privacy layer", "institutional-grade", "pools", "mandate", "we can help you", "I wanted to reach out"
- Antiframing: never define by contrast ("not X, it's Y" / "X, not Y" patterns)
- Ask for 30 minutes, a call, or a demo

EXAMPLES OF THE TONE AND STRUCTURE WE WANT:

--- Example: LinkedIn DM (yield company) ---
Saw you're building institutional DeFi yield products — that's a real infrastructure bet, not a marketing play.

One thing that tends to catch teams off guard at that scale: protocol allocations and position sizes are visible onchain in real-time. Competitors can see exactly where capital is deployed before you rotate.

Working on something a few similar platforms have found useful. Interested to hear more?

--- Example: Email (payments company) ---
Subject: stablecoin payment exposure

Noticed the stablecoin settlement launch — that's a meaningful infrastructure move.

Once you're live on a public chain at volume, payment amounts and recipient wallet addresses are visible to anyone watching. For a company your size, that's supplier relationships and deal pricing in plain sight.

Working on something a few fintechs in this space have found useful. Worth a quick look?

--- Example: Connection note (treasury) ---
Saw ${lead.company_name} is moving treasury onchain — building something that addresses the financial visibility problem that creates for companies at your scale. Would be good to connect.

NOW WRITE THREE FORMATS for ${lead.company_name}. The hook must reference something specific from the signal above — not a generic observation about the industry.

Return ONLY valid JSON with no markdown fences:
{
  "linkedin_connection": "connection note under 300 characters — one specific observation about what they're building, no pitch, no ask beyond connecting",
  "linkedin_dm": "DM under 70 words — hook on the specific signal, one concrete exposure implication, soft CTA. Three short paragraphs.",
  "email_subject": "2-4 word lowercase subject",
  "email_body": "email body under 75 words — hook paragraph, exposure bridge paragraph, CTA paragraph. No more than three paragraphs."
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

  return {
    linkedin_connection: result.linkedin_connection || '',
    linkedin_dm: result.linkedin_dm || '',
    email: `Subject: ${result.email_subject || ''}\n\n${result.email_body || ''}`,
  }
}
