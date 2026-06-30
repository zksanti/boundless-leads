import Anthropic from '@anthropic-ai/sdk'
import type { Lead, Contact } from './types'
import { WORKLOADS } from './workloads'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName
}

export interface OutreachResult {
  linkedin_connection: string
  linkedin_dm: string
  email: string
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
      max_tokens: 4000,
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
  const contactFirstName = contact ? firstName(contact.name) : null
  const contactLine = contact ? `Contact: ${contact.name}, ${contact.title}` : 'No specific contact'

  const prompt = `You are writing a first-touch LinkedIn/email outreach on behalf of the Boundless team (sent from the CEO's account). The goal is to pique interest and get a reply. Lead with a credible value hook, not a question. Do NOT try to qualify them or ask them to reveal cost/usage data in the first message: a stranger will not hand that over before they know us.

ABOUT BOUNDLESS:
Boundless is building an efficient inference cloud that helps teams achieve up to 50% cost savings on large-scale, non-latency-critical AI workloads: batch inference, eval suites, synthetic data, document processing, agent runs, image/video generation on open and custom models. It serves teams that are throughput- and cost-bound, not latency-bound.

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
Before writing, search for ONE specific, recent, TRUE detail about this company's GPU-heavy workload. Good sources: their engineering blog, docs, pricing page (per-page / per-token / volume tiers), a job posting for inference/ML-platform/eval roles, a founder post, or a conference talk. You want a concrete fact that proves you actually understand what they run at scale, e.g. "you process N pages a month", "you run evals on every model release", "you generate synthetic data at scale".

Do 1-3 searches. If you cannot find anything specific, fall back to the signal above. NEVER invent a detail.

---

STEP 2 — WRITE THE MESSAGES.

Structure every message in three beats: (1) one line of specific personalization that names the GPU-heavy workload they actually run (from your research), so it is obviously not a blast; (2) the value hook: we are building an efficient inference cloud that helps teams like them achieve up to 50% cost savings; (3) a frictionless CTA that OFFERS proof and costs them nothing to accept, e.g. "Worth me sending over the benchmark?" or "Want me to send the numbers?" A yes/no that reveals nothing on their side.

RULES:
1. Personalization first, in one line. Show you understand their specific workload and scale. No flattery they already know about themselves.
2. Lead with the value, not a question. Do NOT ask them to explain their cost, throughput, or usage. Do NOT try to qualify them in the first message.
3. State the value as capability: "helps teams achieve up to 50% cost savings". Do NOT claim a specific named customer result unless one is given to you.
4. The CTA offers proof (the benchmark / the numbers) and is answerable in one word. Never demand a meeting, never ask for their data.
5. Sound like a peer exec who understands their workload, not a salesperson.

BANNED (these are exactly what failed before):
- "distributed GPU cloud" (say "efficient inference cloud"), "high-performance cloud", "based on our current customer base"
- asking them to hand over or analyze their data: "let us analyze your bill/usage", "side-by-side cost comparison", "for free", "what's a good benchmark/workload to test"
- "great fit", "I came across", "hope this finds you well", "quick question", "reaching out"
- the words "cheap" / "cheaper" (use "lower cost" / "cost savings")
- em dashes (the — character) anywhere. Use a comma, period, or rewrite.

CHANNEL SPECS:

linkedin_connection (connection note, UNDER 300 characters):
"Hey ${contactFirstName ?? '[First name]'}," then one sentence naming their specific workload, then the value hook in brief (up to 50% cost savings), then a soft "Would be good to connect." No question, no data ask.

linkedin_dm (under 70 words):
Greeting, then the three beats: personalization line, value hook, frictionless proof-offer CTA. End on the CTA (a yes/no like "Worth me sending the benchmark?").

email (under 110 words):
- Subject: 2-4 words, all lowercase, no punctuation, e.g. "inference costs", "your batch pipeline".
- Body: "Hey ${contactFirstName ?? '[First name]'}," then the personalization line, the value hook (up to 50% cost savings), and the proof-offer CTA. No qualifying question, no meeting demand.

---

Return ONLY this JSON, no markdown fences:
{
  "research": {
    "hook": "the specific real detail you will reference",
    "source": "where you found it (or 'signal' if you fell back)",
    "their_real_pain": "one line: the throughput/cost/queue/rate-limit pain this workload likely creates for them"
  },
  "linkedin_connection": "connection note under 300 characters",
  "linkedin_dm": "DM under 70 words",
  "email_subject": "2-4 word lowercase subject",
  "email_body": "email body under 110 words"
}`

  const text = await runWithSearch(prompt)

  let result: {
    linkedin_connection: string
    linkedin_dm: string
    email_subject: string
    email_body: string
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
  }
}
