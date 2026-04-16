import Anthropic from '@anthropic-ai/sdk'
import type { Lead, Contact } from './types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// What actually leaks onchain per use case — the specific exposure that matters
const USE_CASE_EXPOSURE: Record<string, { visible: string; who_cares: string }> = {
  payments: {
    visible:
      'transaction amounts, recipient wallet addresses, and payment timing are all publicly readable on the chain',
    who_cares:
      "their enterprise or institutional clients' compliance teams get nervous when they realise customer payment flows are visible to competitors and analysts",
  },
  yield: {
    visible:
      'protocol allocations, position sizes, and rotation timing are visible onchain in real-time',
    who_cares:
      'their clients or LPs can see exactly where capital is deployed and when it moves, which creates real friction at the institutional level',
  },
  treasury: {
    visible:
      'wallet balances, incoming transfers, and operational spend are publicly readable',
    who_cares:
      'finance and legal teams get nervous once they realise runway, fundraising, and spend patterns are visible to anyone who identifies the wallet',
  },
  tokenization: {
    visible:
      'token transfers, holder concentration, and redemption patterns are traceable on public chains',
    who_cares:
      'fund administrators and IR teams worry about investor composition and exit patterns becoming visible to press and competitors',
  },
}

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

  const prompt = `You are writing a cold outreach message on behalf of the Boundless team.

Boundless builds compliance infrastructure for onchain finance — specifically, it makes onchain transactions private by default while keeping them compliant. Early partners include the XRPL and Stellar ecosystem teams, who are using it to unblock institutional adoption on their chains.

---

PROSPECT CONTEXT:
Company: ${lead.company_name}
What they do: ${lead.description}
Signal (what triggered this outreach): ${lead.signal}
Use case: ${lead.use_case}
Why relevant for them: ${lead.why_boundless_fits}
${contactLine}
First name: ${contactFirstName ?? 'not available'}

ONCHAIN EXPOSURE CONTEXT:
What leaks: ${exposure.visible}
Who feels the pain: ${exposure.who_cares}

---

BEFORE WRITING, reason through these questions:

1. What does this person ALREADY KNOW cold? They are an expert in their field. What would feel condescending or obvious to them?
2. What friction point is their current business model creating right now that they have probably NOT fully solved? This is not their achievement — it is the obstacle their success is generating. For a company building enterprise stablecoin products, that friction is probably what their enterprise clients' compliance teams are pushing back on, not whether the rails work.
3. What angle would make this feel like it came from someone who actually understands their business, not someone who Googled them?
4. Does Boundless have enough credibility to be taken seriously by someone at this level? (Answer: yes — early XRPL and Stellar partnerships are real proof points that resonate in this space.)

Write your answers briefly, then write the messages.

---

STRUCTURE FOR THE EMAIL:

1. "Hey ${contactFirstName ?? '[Name]'}," if first name available
2. Hook: Name the specific friction point they are probably running into RIGHT NOW given their business model and where they are. NOT their achievement. NOT something that happened to them (funding, acquisition, etc). The thing their current scale or customer base is creating as a challenge. Be specific enough that it reads like you understand their actual business.
3. Exposure bridge: "You probably know, but [what specifically leaks and who it creates a problem with — their clients, their compliance team, their LPs]." One to two sentences.
4. Boundless intro: "At Boundless, we handle the compliance and confidentiality layer so [specific outcome for their use case]. We are early — XRPL and Stellar are our first ecosystem partners, and both found [relevant outcome]."
5. CTA: One interest check. Not a meeting ask. "Curious if this is something you are actively thinking about?" or "Worth a conversation?"

STRUCTURE FOR LINKEDIN DM (shorter):
Greeting, hook, bridge only. Skip the Boundless intro. Close with interest check.

STRUCTURE FOR CONNECTION NOTE (follow this template closely):
"Hey [First Name]. Big fan of what you guys are building at [Company]. My team is building [use-case one-liner]. Would be good to connect."

The opener is just "Big fan of what you guys are building at [Company]." — warm, genuine, human. Do NOT replace it with a researched observation or a specific claim about their positioning. That reads as AI-generated analysis, not a real person. Save the research for the DM. The connection note's only job is: who I am + what we're building + let's connect.

Use-case one-liners (use these verbatim — they are framed as complementary/additive, not competitive):
- payments: "bringing confidentiality to public stablecoin payments, compliance-first"
- yield: "bringing confidentiality to onchain yield, compliance-first"
- treasury: "bringing confidentiality to onchain treasury management, compliance-first"
- tokenization: "bringing confidentiality to public tokenized assets, compliance-first"

Example (payments): "Hey Nate. Big fan of what you guys are building at Agora. My team is bringing confidentiality to public stablecoin payments, compliance-first. Would be good to connect."

Under 300 characters total.

---

RULES — read these carefully:

EM DASHES: COMPLETELY BANNED. The character — must not appear anywhere in your output. Use a comma, a period, or rewrite the sentence. There is a post-processing step that will flag any em dashes.

- Do not open with "I" or "We"
- Do not compliment them on things they obviously know about themselves ("you are one of the leading stablecoin companies", "you are moving fast", "your growth is impressive")
- Do not use generic B2B opener language: "I came across", "I wanted to reach out", "Hope this finds you well", "Quick question"
- Do not explain their industry to them — they are the expert, you are the peer
- No staccato punchy sentences stacked together — write complete, connected sentences
- BANNED PHRASES: "compliance layer", "confidentiality layer", "privacy layer", "institutional-grade", "pools", "mandate", "we can help you with", "game-changing"
- Do not summarize their company back to them
- Subject line: 2 to 4 words, all lowercase, no punctuation — should read like an internal message, not a marketing email

---

Return your reasoning AND the messages in this JSON format. No markdown fences:
{
  "reasoning": {
    "what_they_know": "one sentence on what this person already knows cold",
    "their_real_friction": "the specific friction their current business model is creating",
    "credibility_angle": "why Boundless is credible to someone at this level"
  },
  "linkedin_connection": "connection note under 300 characters",
  "linkedin_dm": "DM under 75 words, greeting if name available, three short paragraphs",
  "email_subject": "2-4 word lowercase subject",
  "email_body": "email under 110 words, five-part structure above"
}`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = response.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type')

  let result: {
    reasoning: { what_they_know: string; their_real_friction: string; credibility_angle: string }
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

  // Hard strip any em dashes that slipped through
  const clean = (s: string) => s.replace(/\s*—\s*/g, ', ').replace(/—/g, ', ')

  return {
    linkedin_connection: clean(result.linkedin_connection || ''),
    linkedin_dm: clean(result.linkedin_dm || ''),
    email: clean(`Subject: ${result.email_subject || ''}\n\n${result.email_body || ''}`),
  }
}
