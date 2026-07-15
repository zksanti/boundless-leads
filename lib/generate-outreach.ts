import Anthropic from '@anthropic-ai/sdk'
import type { Lead, Contact, Segment } from './types'
import { WORKLOADS } from './workloads'
import { SEGMENTS } from './segments'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName
}

export interface OutreachResult {
  linkedin_connection: string
  linkedin_dm: string
  email: string
  x_dm: string
}

// Runs a message with the server-side web_search tool, resuming through any
// pause_turn stops, and returns the concatenated text of the final turn.
async function runWithSearch(prompt: string): Promise<string> {
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: prompt }]
  let response: Anthropic.Message | null = null

  // Server-side tool loops resume on pause_turn — re-send the assistant turn to continue.
  for (let i = 0; i < 6; i++) {
    response = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 4500,
      thinking: { type: 'adaptive' },
      tools: [{ type: 'web_search_20260209', name: 'web_search' }],
      messages,
    })
    if (response.stop_reason !== 'pause_turn') break
    messages.push({ role: 'assistant', content: response.content })
  }

  if (!response) throw new Error('No response from outreach model')

  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim()
}

export async function generateOutreach(
  lead: Lead,
  contact: Contact | null
): Promise<OutreachResult> {
  const workload = WORKLOADS[lead.use_case] ?? WORKLOADS.batch
  const seg = SEGMENTS[(lead.segment || 'platforms') as Segment] ?? SEGMENTS.platforms
  const contactFirstName = contact ? firstName(contact.name) : null
  const contactLine = contact ? `Contact: ${contact.name}, ${contact.title}` : 'No specific contact'

  const prompt = `You are writing first-touch outreach on behalf of Santiago at Boundless (customer discovery experiment, sent from his personal accounts). The goal is a substantive reply. This is discovery and proof-building, not scaled sales.

ABOUT BOUNDLESS:
Boundless provides GPUs to companies running AI workloads, such as inference, training, evals, and more. Customers bring their existing model, container, serving, or training stack; Boundless provides the GPU capacity.
The customer promise: show us one workload, and we will determine whether Boundless can run it more economically while meeting the performance and reliability requirements that matter.

SEGMENT: ${seg.label}
Segment positioning: ${seg.positioning}

PROSPECT CONTEXT:
Company: ${lead.company_name}
What they do: ${lead.description}
Website: ${lead.website_url || 'unknown'}
Why we think they fit: ${lead.why_boundless_fits}
Signal that triggered this: ${lead.signal}
Workload type: ${workload.label}
Typical pain for this workload: ${workload.pain}
${contactLine}
First name: ${contactFirstName ?? 'not available'}

---

STEP 1 — RESEARCH (use the web_search tool):
Before writing, search for ONE specific, recent, TRUE detail about this company's GPU-heavy workload. Good sources: their engineering blog, docs, changelog, pricing page, a job posting for inference/ML-platform/post-training roles, a founder post, or a conference talk. You want a concrete fact that proves this is not a blast.

Do 1-3 searches. If you cannot find anything specific, fall back to the signal above. NEVER invent a detail.

---

STEP 2 — WRITE THE MESSAGES.

TEAM-APPROVED TEMPLATES FOR THIS SEGMENT — these are the BASIS, not scripts. Match their structure, offer, and register, but write each message fresh around the real researched detail. Do not fill in the brackets mechanically; a reader should never be able to tell a template existed.

EMAIL TEMPLATE:
${seg.templates.email}

LINKEDIN CONNECTION TEMPLATE:
${seg.templates.linkedin_connection}

LINKEDIN DM TEMPLATE (post-acceptance):
${seg.templates.linkedin_dm}

X DM TEMPLATE:
${seg.templates.x_dm}

EVERY MESSAGE CONTAINS FOUR THINGS (the team's messaging principles):
1. A specific signal showing why this company was selected (your researched detail).
2. What Boundless is trying to accomplish for companies like theirs (from the segment positioning).
3. Why their particular workload may be relevant.
4. A small, low-pressure next step.

THE OFFER: we benchmark one representative workload at no cost and share the complete results. Never claim a specific percentage saving or a customer result. The benchmark IS the pitch: it is falsifiable on their workload, which is what makes it credible.

VOICE — this must sound like a person typing, or it gets skipped:
- First person. "I'm at Boundless, we run..." Never "Boundless is a company that...".
- Contractions everywhere. Plain verbs. No conditional-formal ("we would agree on the relevant metrics" → "we'll benchmark it and send you everything we measure").
- One question per message, and it ends the message.
- Be honestly early: "we're doing this with a handful of teams" is true and reads that way.
- No balanced-clause antithesis constructions ("you keep X, we provide Y"). No "The offer, plainly:". No framing labels.
- The connection note may end with "Would be good to connect." (proven closer, keep it).

BANNED:
- claiming any % cost saving, "up to 50%", or "we helped [customer] achieve X" (no audited customer results exist yet)
- "distributed GPU cloud", "high-performance cloud", "rate card"
- asking them to hand over cost/usage data in the first message, or to explain how they run things today (qualifying questions belong on the call)
- "great fit", "I came across", "hope this finds you well", "quick question", "reaching out", "your work looked relevant"
- the words "cheap" / "cheaper" (use "lower cost" / "economics")
- em dashes (the — character) anywhere. Use a comma, period, or " - " (hyphen with spaces).

CHANNEL SPECS:
- linkedin_connection: UNDER 300 characters. Signal, one line on what we do for this segment, "Would be good to connect."
- linkedin_dm: under 70 words. Post-acceptance message per the template.
- email: subject 2-5 words matching the template's subject pattern, lowercase is fine. Body under 110 words.
- x_dm: under 60 words, the most casual of the four. Reference their post/launch if the researched detail is one.

---

Return ONLY this JSON, no markdown fences:
{
  "research": {
    "hook": "the specific real detail you will reference",
    "source": "where you found it (or 'signal' if you fell back)",
    "their_real_pain": "one line: the cost/capacity pain this workload likely creates for them"
  },
  "linkedin_connection": "connection note under 300 characters",
  "linkedin_dm": "post-acceptance DM under 70 words",
  "email_subject": "short subject",
  "email_body": "email body under 110 words",
  "x_dm": "X DM under 60 words"
}`

  const text = await runWithSearch(prompt)

  let result: {
    linkedin_connection: string
    linkedin_dm: string
    email_subject: string
    email_body: string
    x_dm: string
  }

  try {
    const jsonStr = text.startsWith('{') ? text : (text.match(/\{[\s\S]*\}/) ?? ['{}'])[0]
    result = JSON.parse(jsonStr)
  } catch {
    throw new Error('Could not parse outreach response')
  }

  // Hard strip any em dashes that slipped through.
  const clean = (s: string) => s.replace(/\s*—\s*/g, ', ').replace(/—/g, ', ')

  return {
    linkedin_connection: clean(result.linkedin_connection || ''),
    linkedin_dm: clean(result.linkedin_dm || ''),
    email: clean(`Subject: ${result.email_subject || ''}\n\n${result.email_body || ''}`),
    x_dm: clean(result.x_dm || ''),
  }
}
