import type { NextRequest } from 'next/server'
import {
  getLeadById,
  getConversationsForLead,
  insertConversation,
  updateConversationAnalysis,
  updateLeadValidation,
  insertLearning,
  getSetting,
} from '@/lib/db'
import { analyzeConversation, mergeValidation } from '@/lib/analyze-conversation'
import { CONVERSATION_KIND_VALUES } from '@/lib/taxonomy'

export const maxDuration = 60

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const conversations = await getConversationsForLead(id)
    return Response.json({ conversations })
  } catch (error) {
    console.error('GET /api/leads/[id]/conversations error:', error)
    return Response.json({ error: 'Failed to load conversations' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { content, kind, occurred_at } = await request.json()

    if (!content?.trim()) {
      return Response.json({ error: 'Missing content' }, { status: 400 })
    }
    if (!CONVERSATION_KIND_VALUES.includes(kind)) {
      return Response.json({ error: 'Invalid kind' }, { status: 400 })
    }

    const lead = await getLeadById(id)
    if (!lead) {
      return Response.json({ error: 'Lead not found' }, { status: 404 })
    }

    const prior = await getConversationsForLead(id)
    const conversation = await insertConversation({
      lead_id: id,
      kind,
      content: content.trim(),
      occurred_at,
    })

    const analysis = await analyzeConversation(
      lead,
      { kind, content: content.trim(), occurred_at: conversation.occurred_at ?? new Date().toISOString() },
      prior
    )

    // Analysis failing is non-fatal: the conversation is stored either way and
    // can be re-analyzed by deleting + re-logging.
    if (!analysis) {
      return Response.json({ conversation, validation: lead.validation, learnings: [], suggestedStage: null })
    }

    await updateConversationAnalysis(conversation.id, analysis.primary_tag ?? '', analysis.secondary_tag ?? '', analysis)

    const validation = mergeValidation(lead.validation, analysis.validation)
    await updateLeadValidation(id, validation)

    const mode = (await getSetting('learning_mode')) ?? 'review'
    const learnings = []
    for (const l of analysis.learnings) {
      learnings.push(
        await insertLearning({
          category: l.category,
          segment: lead.segment,
          content: l.content,
          source: 'conversation',
          conversation_id: conversation.id,
          lead_id: id,
          status: mode === 'auto' ? 'accepted' : 'pending',
          auto_applied: mode === 'auto',
        })
      )
    }

    return Response.json({
      conversation: { ...conversation, primary_tag: analysis.primary_tag ?? '', secondary_tag: analysis.secondary_tag ?? '', analysis },
      validation,
      learnings,
      suggestedStage: analysis.suggested_stage,
      stageRationale: analysis.stage_rationale,
    })
  } catch (error) {
    console.error('POST /api/leads/[id]/conversations error:', error)
    return Response.json({ error: 'Failed to save conversation' }, { status: 500 })
  }
}
