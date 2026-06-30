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

  const prompt = `You are writing customer-discovery outreach on behalf of the Boundless team. This is DISCOVERY, not sales. The goal is a reply and a short conversation where we LEARN about how they run their workload, not to pitch or close.

ABOUT BOUNDLESS (keep this in the background, do not pitch it):
Boundless runs a distributed GPU cloud for large-scale, non-latency-critical AI workloads: batch inference, eval suites, synthetic data, document processing, agent runs, image/video generation on open and custom models. It is built for teams that are throughput- and cost-bound, not latency-bound.

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

The whole point: these must NOT read like the templated sales blasts that got zero replies. Those failed because they pitched ("high-performance cloud", "cut costs 50%"), asked the prospect to hand over data ("let us analyze your bill"), and assigned homework ("what's a good benchmark to test?"). Do the opposite.

DISCOVERY RULES:
1. Lead with THEIR world. Open by naming the specific workload they run (from your research). Make it clear you understand what they actually do at scale.
2. Ask exactly ONE genuine, curious question about the reality of running that workload: cost, throughput, queue time, rate limits, or GPU availability. It should be answerable in one line and feel like a peer is curious, not a vendor qualifying them.
3. NO pitch. Do not describe Boundless as a product, do not claim any savings or percentages, do not offer a free analysis, cost comparison, trial, or benchmark.
4. At most ONE short, low-key sentence on who you are, and only if it helps the question land (e.g. "I'm with Boundless, we run GPU capacity for batch and eval workloads"). Frame it as context for why you're curious, never as an offer.
5. Sound like a peer who runs infrastructure, not a salesperson. No flattery they already know about themselves.

BANNED (these are exactly what failed):
- "high-performance cloud", "built for AI workloads", "based on our current customer base"
- any savings claim: "cut your costs", "cut your bill", "X% cheaper", "save up to", "lower your spend"
- "side-by-side cost comparison", "analyze your costs/usage/bill", "for free", "run a benchmark", "what's a good benchmark/workload to test"
- "great fit", "I'd love to", "I came across", "hope this finds you well", "quick question", "reaching out"
- the words "cheap" / "cheaper"
- em dashes (the — character) anywhere. Use a comma, period, or rewrite.

CHANNEL SPECS:

linkedin_connection (connection note, UNDER 300 characters):
"Hey ${contactFirstName ?? '[First name]'}," then one sentence naming their specific workload + one short curious line, then a soft "Would be good to connect." No question mark spam, no pitch.

linkedin_dm (under 70 words):
Greeting, then 2-3 short sentences: name the specific workload, ask the one curious question, optionally one low-key line on who you are. End on the question or a light "curious how you think about this."

email (under 110 words):
- Subject: 2-4 words, all lowercase, no punctuation. Should read like a note from a peer, e.g. "eval throughput", "your batch pipeline".
- Body: "Hey ${contactFirstName ?? '[First name]'}," then the specific-workload hook, then the one curious question, optional one-line who-we-are, then a soft close like "Curious how you're handling this as you scale?" Never a hard meeting ask.

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
