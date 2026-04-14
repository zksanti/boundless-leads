import Anthropic from '@anthropic-ai/sdk'
import type { Lead, Contact } from './types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export interface OutreachResult {
  linkedin_connection: string
  linkedin_dm: string
  email: string
}

export async function generateOutreach(
  lead: Lead,
  contact: Contact | null
): Promise<OutreachResult> {
  const prompt = `You write cold outreach for Boundless, a compliance infrastructure company for onchain finance.

BOUNDLESS RULES:
- First message NEVER names Boundless
- Under 75 words total
- NO em dashes
- BANNED WORDS: "institutional-grade", "pools", "mandate"
- Open with THEM not "I" or "We"
- One CTA only, low friction ("Worth a quick chat?" not "Can we book 30 minutes?")
- Subject lines: 2-4 words, lowercase, no punctuation
- Write like a peer, not a vendor
- Hook on a specific signal, not a generic opener

LEAD:
Company: ${lead.company_name}
Description: ${lead.description}
Signal: ${lead.signal}
Use case: ${lead.use_case}
Why Boundless fits: ${lead.why_boundless_fits}
${contact ? `Contact: ${contact.name}, ${contact.title}` : ''}

Generate three outreach formats. Return ONLY JSON, no markdown:
{
  "linkedin_connection": "connection request note under 300 characters",
  "linkedin_dm": "full DM under 75 words",
  "email_subject": "2-4 word lowercase subject",
  "email_body": "email body under 75 words"
}`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
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
