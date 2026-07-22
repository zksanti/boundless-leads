import Anthropic from '@anthropic-ai/sdk'
import type { Segment, Lead } from './types'
import { SEGMENTS } from './segments'
import { tagLabel } from './taxonomy'
import {
  getActiveICPProfile,
  getSegmentSwipeStats,
  getSegmentSwipedLeads,
  getAcceptedLearnings,
  getResponseTagAggregates,
  getActiveRefinements,
} from './db'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export interface ICPProfileDraft {
  qualification: string[]
  exclude: string[]
  signals: string[]
  guidance: string
  change_summary: string
  source_counts: Record<string, number>
}

function fmtLeads(leads: Lead[], withReasons: boolean): string {
  if (leads.length === 0) return '  (none)'
  return leads
    .map((l) => {
      const reason = withReasons && l.rejection_reason ? ` | stated reason: "${l.rejection_reason}"` : ''
      return `- ${l.company_name} (${l.use_case}, Tier ${l.tier}): ${l.description} | signal: ${l.signal}${reason}`
    })
    .join('\n')
}

// Re-synthesize the living ICP for one segment from every learning source:
// swipes, stated rejection reasons, accepted icp learnings from real
// conversations, response-tag distribution, and still-active AI refinements.
export async function synthesizeICPProfile(segment: Segment): Promise<ICPProfileDraft | null> {
  const seg = SEGMENTS[segment]

  const [active, stats, swiped, learnings, allTags, refinements] = await Promise.all([
    getActiveICPProfile(segment),
    getSegmentSwipeStats(segment),
    getSegmentSwipedLeads(segment),
    getAcceptedLearnings('icp', segment),
    getResponseTagAggregates(),
    getActiveRefinements(),
  ])

  const tags = allTags.filter((t) => t.segment === segment)
  const aiRefinements = refinements.filter((r) => r.source === 'ai')
  const reasonsCount = [...swiped.accepted, ...swiped.rejected].filter((l) => l.rejection_reason).length

  const current = active
    ? `CURRENT ACTIVE PROFILE (v${active.version}):
Qualification:
${(active.qualification as string[]).map((q) => `- ${q}`).join('\n')}
Exclude:
${(active.exclude as string[]).map((e) => `- ${e}`).join('\n')}
Signals:
${(active.signals as string[]).map((s) => `- ${s}`).join('\n')}
Learned guidance: ${active.guidance || '(none)'}`
    : 'CURRENT ACTIVE PROFILE: none — the baseline below is current.'

  const statsLines = stats.length > 0
    ? stats.map((s) => {
        const total = s.accepted + s.rejected
        return `  ${s.use_case} Tier ${s.tier}: ${Math.round((s.accepted / total) * 100)}% approved (${s.accepted}/${total})`
      }).join('\n')
    : '  (no swipes for this segment yet)'

  const prompt = `You maintain the living ideal-customer-profile for the "${seg.label}" segment of Boundless's customer discovery experiment. Boundless provides GPUs to companies running AI workloads; customers bring their existing stack, Boundless provides the capacity.

BASELINE (v0, from the experiment doc):
Qualification:
${seg.researchQualification.map((q) => `- ${q}`).join('\n')}
Exclude:
${seg.exclude.map((e) => `- ${e}`).join('\n')}
Signals:
${seg.signals.map((s) => `- ${s}`).join('\n')}

${current}

EVIDENCE SINCE ${active ? `v${active.version}` : 'v0'}:

Swipe approval rates for this segment:
${statsLines}

Recently ACCEPTED leads:
${fmtLeads(swiped.accepted, false)}

Recently REJECTED leads (stated reasons matter most):
${fmtLeads(swiped.rejected, true)}

Accepted ICP learnings from real prospect conversations:
${learnings.length > 0 ? learnings.map((l) => `- ${l.content}`).join('\n') : '  (none yet)'}

Response-tag distribution from replies and calls in this segment:
${tags.length > 0 ? tags.map((t) => `  ${tagLabel(t.primary_tag)}: ${t.count}`).join('\n') : '  (no tagged responses yet)'}

Approved search refinements not yet folded into a profile:
${aiRefinements.length > 0 ? aiRefinements.map((r) => `- ${r.content}`).join('\n') : '  (none)'}

Produce the next version of this segment's ICP profile.
- Keep items still supported by evidence; change only what the evidence justifies.
- Prefer SHARPENING an existing item over adding a new one. Consolidate overlapping items.
- Maximum 8 items per list, one sentence each.
- "guidance" is freeform search guidance (max 120 words) for anything that does not fit the lists — patterns about stage, size, stack, or what the researcher responds to.
- If the evidence is thin, make fewer, smaller changes. Never invent a pattern the evidence does not show.

Return ONLY valid JSON, no markdown:
{
  "qualification": ["..."],
  "exclude": ["..."],
  "signals": ["..."],
  "guidance": "...",
  "change_summary": "3-6 lines, each formatted 'Added: <what> — because <evidence>' / 'Removed: ...' / 'Reworded: ...'. If a list is unchanged, do not mention it."
}`

  let response
  try {
    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })
  } catch (e) {
    console.error('generate-icp-profile: API call failed', e)
    return null
  }

  const content = response.content[0]
  if (content.type !== 'text') return null

  let parsed: { qualification: string[]; exclude: string[]; signals: string[]; guidance: string; change_summary: string }
  try {
    const text = content.text.trim()
    const jsonStr = text.startsWith('{') ? text : (text.match(/\{[\s\S]*\}/) ?? ['{}'])[0]
    parsed = JSON.parse(jsonStr)
  } catch (e) {
    console.error('generate-icp-profile: JSON parse failed', e)
    return null
  }

  const list = (arr: unknown): string[] =>
    Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string' && x.trim() !== '').slice(0, 8) : []

  const qualification = list(parsed.qualification)
  const exclude = list(parsed.exclude)
  const signals = list(parsed.signals)
  if (qualification.length === 0 || exclude.length === 0) return null

  return {
    qualification,
    exclude,
    signals,
    guidance: (parsed.guidance ?? '').trim(),
    change_summary: (parsed.change_summary ?? '').trim(),
    source_counts: {
      swipes: swiped.accepted.length + swiped.rejected.length,
      rejection_reasons: reasonsCount,
      learnings: learnings.length,
      tags: tags.reduce((s, t) => s + t.count, 0),
    },
  }
}
