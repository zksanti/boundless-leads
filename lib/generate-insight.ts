import Anthropic from '@anthropic-ai/sdk'
import type { Lead } from './types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function generateInsight(
  accepted: Lead[],
  rejected: Lead[]
): Promise<{ insight: string; refinement: string } | null> {
  if (accepted.length + rejected.length < 10) return null

  const fmt = (leads: Lead[]) =>
    leads
      .map((l) => `- ${l.company_name} (${l.use_case}, Tier ${l.tier}): ${l.description} | Signal: ${l.signal}`)
      .join('\n') || '  (none yet)'

  const prompt = `You are analyzing a sales rep's lead swipe behavior for Boundless (compliance infrastructure for onchain finance: payments, yield, treasury, tokenization on public chains).

LEADS THEY ACCEPTED (${accepted.length}):
${fmt(accepted)}

LEADS THEY PASSED ON (${rejected.length}):
${fmt(rejected)}

Analyze the patterns. Look for: use case preference, company type (fintech vs TradFi vs DeFi), maturity stage, signals that triggered acceptance, signals that triggered rejection, tier preference.

Return ONLY valid JSON, no markdown:
{
  "insight": "2-3 sentences describing what this person prefers and what they avoid. Be specific — name actual patterns from the data, not generic observations. Write in second person ('Your swipes show...'). End with one concrete implication.",
  "refinement": "1-2 sentences of actionable guidance to inject into future lead generation prompts. Start with 'Prioritize...' or 'Focus on...'. Be specific enough that a researcher could use it to find better leads."
}`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = response.content[0]
  if (content.type !== 'text') return null

  try {
    const text = content.text.trim()
    const jsonStr = text.startsWith('{') ? text : (text.match(/\{[\s\S]*\}/) ?? ['{}'])[0]
    return JSON.parse(jsonStr)
  } catch {
    return null
  }
}
