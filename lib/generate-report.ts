import Anthropic from '@anthropic-ai/sdk'
import type { Lead, Contact } from './types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function generateReport(lead: Lead, contacts: Contact[]): Promise<string> {
  const contactLines = contacts.length
    ? contacts.map((c) => `- ${c.name} (${c.title})${c.linkedin_url ? ` — ${c.linkedin_url}` : ''}`).join('\n')
    : '- No contacts on file'

  const prompt = `You are preparing a discovery-call prep brief for the Boundless team. Boundless runs a distributed GPU cloud for non-latency-critical AI workloads (batch inference, evals, synthetic data, document processing, agent runs, image/video on open and custom models). This is CUSTOMER DISCOVERY: the goal of the call is to learn how this team runs its workload and where cost, throughput, queue time, rate limits, or GPU availability hurt, not to pitch.

COMPANY: ${lead.company_name}
WEBSITE: ${lead.website_url || 'unknown'}
DESCRIPTION: ${lead.description}
QUALIFYING SIGNAL: ${lead.signal}
WORKLOAD TYPE: ${lead.use_case}
COMPANY SIZE: ${lead.company_size || 'unknown'}
FUNDING: ${lead.funding || 'unknown'}
WHY THEY FIT: ${lead.why_boundless_fits}

KNOWN CONTACTS:
${contactLines}

Generate a comprehensive discovery-call prep brief in clean markdown. Be specific and concrete — no filler. Cover each section below.

---

## Company Overview
What they actually build, who their customers are, business model, and any notable traction or scale indicators.

## Their GPU Workload
The specific recurring AI workloads they run (evals, synthetic data, agent runs, document processing, image/video, batch inference). What models and roughly what scale (pages, tokens, requests). Why it is throughput- and cost-bound rather than latency-critical.

## Where It Hurts
Where cost, throughput, queue time, rate limits, or GPU availability likely create pain today, given their scale and stage. Be concrete about which workload and why.

## Recent News & Signals (last 6 months)
Funding, product launches, key hires (especially infra / ML platform / eval roles), pricing changes, and any public writing about inference cost or scaling. Flag anything that makes the pain acute right now.

## Key People
For each known contact and any other likely decision-makers (founder, CTO, infra lead, ML platform lead, eval lead): background, likely role in an infra decision, and anything notable from public presence.

## Boundless Fit — Specific Mapping
Map their exact workload to where Boundless capacity would plug in. Name the specific job (which pipeline, which batch/eval/async lane). Note any latency or privacy constraint that would keep part of the workload off external compute for now.

## Discovery Questions (Mom Test style)
10 sharp, non-leading questions tailored to this company. Ask about how they run the workload today, what it costs them in time/money, what they have tried, and what is actually painful — not whether they would buy. Avoid pitching and avoid hypotheticals; anchor on their real current behavior.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = response.content[0]
  if (content.type !== 'text') return ''
  return content.text
}
