import Anthropic from '@anthropic-ai/sdk'
import type { Lead, Conversation, ConversationAnalysis, ValidationRecord, CRMStage } from './types'
import { SEGMENTS } from './segments'
import { RESPONSE_TAGS, RESPONSE_TAG_VALUES, kindLabel } from './taxonomy'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const VALID_STAGES: CRMStage[] = [
  'needs_outreach', 'outreach_sent', 'follow_up_due', 'replied', 'call_scheduled',
  'post_call', 'in_evaluation', 'proposal_sent', 'nurture', 'closed_won', 'closed_lost',
]

const EMPTY_VALIDATION: ValidationRecord = {
  workload: '',
  workload_status: 'unknown',
  current_provider: '',
  pain: '',
  blockers: [],
  fit_confidence: '',
  open_questions: [],
  next_step: '',
}

// Deterministic guardrail on messaging learnings: nothing that could smuggle a
// cost-percentage claim, customer-result claim, "cheap", or an em dash into the
// outreach prompt survives, regardless of review/auto mode.
const BANNED_LEARNING = /%|\bcheap(er|ness)?\b|—|\d+x\s+(lower|cheaper|less)|customers?\s+(saved|save|cut|reduced)/i

export function isBannedMessagingLearning(content: string): boolean {
  return BANNED_LEARNING.test(content)
}

// Merge a new (possibly sparse) validation extraction into the lead's existing
// record. "unknown"/empty never overwrites something a prior conversation
// established; fresher non-empty values win because discovery moves forward.
export function mergeValidation(
  existing: ValidationRecord | null,
  incoming: ValidationRecord
): ValidationRecord {
  const base = existing ?? EMPTY_VALIDATION
  return {
    workload: incoming.workload?.trim() || base.workload,
    workload_status: incoming.workload_status !== 'unknown' ? incoming.workload_status : base.workload_status,
    current_provider: incoming.current_provider?.trim() || base.current_provider,
    pain: incoming.pain?.trim() || base.pain,
    blockers: Array.from(new Set([...base.blockers, ...(incoming.blockers ?? []).filter((b) => b?.trim())])),
    fit_confidence: incoming.fit_confidence || base.fit_confidence,
    open_questions: (incoming.open_questions ?? []).filter((q) => q?.trim()).length > 0
      ? (incoming.open_questions ?? []).filter((q) => q?.trim())
      : base.open_questions,
    next_step: incoming.next_step?.trim() || base.next_step,
  }
}

// The neon driver returns TIMESTAMPTZ columns as Date objects; the API layer
// passes strings. Normalize either into YYYY-MM-DD for the prompt.
function toDay(value: string | Date | null | undefined): string {
  if (!value) return 'unknown date'
  const d = new Date(value)
  return isNaN(d.getTime()) ? 'unknown date' : d.toISOString().slice(0, 10)
}

export async function analyzeConversation(
  lead: Lead,
  conversation: { kind: string; content: string; occurred_at: string },
  priorConversations: Conversation[]
): Promise<ConversationAnalysis | null> {
  const seg = lead.segment ? SEGMENTS[lead.segment] : null

  const priorContext = priorConversations
    .filter((c) => c.analysis?.summary)
    .slice(0, 6)
    .map((c) => `- ${kindLabel(c.kind)} (${toDay(c.occurred_at)}): ${c.analysis!.summary}`)
    .join('\n')

  const prompt = `You are analyzing a prospect interaction for Boundless's customer discovery experiment. Boundless provides GPUs to companies running AI workloads (inference, training, evals, and more); customers bring their existing model, container, serving, or training stack, and Boundless provides the GPU capacity.

LEAD: ${lead.company_name} — ${lead.description || 'no description'}
Segment: ${seg ? `${seg.label} — ${seg.description}` : 'unassigned'}
Current CRM stage: ${lead.crm_stage}
Original signal: ${lead.signal || 'none'}
Why we thought they fit: ${lead.why_boundless_fits || 'unknown'}
Current validation record: ${lead.validation ? JSON.stringify(lead.validation) : 'none yet'}
Prior interactions:
${priorContext || '- none'}

NEW INTERACTION (${kindLabel(conversation.kind)}, ${toDay(conversation.occurred_at)}):
"""
${conversation.content}
"""

RESPONSE TAXONOMY — pick the single best primary tag for what the PROSPECT said, optionally one secondary. null if there is no readable prospect response (e.g. your own notes with no reply in them):
${RESPONSE_TAGS.map((t) => `- ${t.tag}: ${t.definition}`).join('\n')}

CRM STAGES: ${VALID_STAGES.join(', ')}

Return ONLY valid JSON, no markdown:
{
  "primary_tag": "<taxonomy tag>" | null,
  "secondary_tag": "<taxonomy tag>" | null,
  "validation": {
    "workload": "the specific GPU workload discussed, or ''",
    "workload_status": "confirmed" | "denied" | "unknown",
    "current_provider": "their current infrastructure provider if stated, or ''",
    "pain": "the cost/capacity/availability problem in their words, or ''",
    "blockers": ["stated blockers or objections"],
    "fit_confidence": "high" | "medium" | "low" | "",
    "open_questions": ["open technical questions to resolve next"],
    "next_step": "the concrete next step if one was agreed or implied, or ''"
  },
  "suggested_stage": "<CRM stage>" | null,
  "stage_rationale": "one sentence",
  "learnings": [{ "category": "icp" | "messaging", "content": "one generalizable sentence" }],
  "summary": "1-2 sentences on what happened in this interaction"
}

Rules:
- A learning must generalize BEYOND this one company ("Teams reselling closed APIs never have a workload" qualifies; "Acme uses Modal" does not). 0 learnings is a fine answer; a short reply rarely justifies more than 1. Maximum 3.
- "icp" learnings describe who to target or avoid. "messaging" learnings describe what wording, angle, offer, or channel landed or failed.
- NEVER propose a messaging learning containing cost percentages, savings multiples, or customer-result claims — Boundless has no audited cost metric yet.
- For "validation", only fill fields this interaction actually evidences; use "unknown"/'' otherwise (existing values are preserved, you cannot erase them).
- Only suggest a stage that is FORWARD progress evidenced by this interaction (e.g. they agreed to a call → call_scheduled). null if the current stage still fits.`

  // Analysis is best-effort: an API failure must not lose the pasted
  // conversation, so surface null and let the route store the raw content.
  let response
  try {
    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })
  } catch (e) {
    console.error('analyze-conversation: API call failed', e)
    return null
  }

  const content = response.content[0]
  if (content.type !== 'text') return null

  let parsed: ConversationAnalysis
  try {
    const text = content.text.trim()
    const jsonStr = text.startsWith('{') ? text : (text.match(/\{[\s\S]*\}/) ?? ['{}'])[0]
    parsed = JSON.parse(jsonStr)
  } catch (e) {
    console.error('analyze-conversation: JSON parse failed', e)
    return null
  }

  // Server-side validation — the model's output never reaches the DB unchecked
  const validTags = new Set<string>(RESPONSE_TAG_VALUES)
  const primary = parsed.primary_tag && validTags.has(parsed.primary_tag) ? parsed.primary_tag : null
  const secondary = parsed.secondary_tag && validTags.has(parsed.secondary_tag) ? parsed.secondary_tag : null
  const stage = parsed.suggested_stage && VALID_STAGES.includes(parsed.suggested_stage) ? parsed.suggested_stage : null

  const learnings = (parsed.learnings ?? [])
    .filter((l) => l && (l.category === 'icp' || l.category === 'messaging') && l.content?.trim())
    .slice(0, 3)
    .filter((l) => {
      if (l.category === 'messaging' && isBannedMessagingLearning(l.content)) {
        console.warn('analyze-conversation: dropped banned messaging learning:', l.content)
        return false
      }
      return true
    })

  return {
    primary_tag: primary,
    secondary_tag: secondary,
    validation: { ...EMPTY_VALIDATION, ...(parsed.validation ?? {}) },
    suggested_stage: stage,
    stage_rationale: parsed.stage_rationale ?? '',
    learnings,
    summary: parsed.summary ?? '',
  }
}
