import type { NextRequest } from 'next/server'
import { updateCRMStage } from '@/lib/db'
import type { CRMStage } from '@/lib/types'

const VALID_STAGES: CRMStage[] = [
  'needs_outreach',
  'outreach_sent',
  'follow_up_due',
  'replied',
  'call_scheduled',
  'post_call',
  'in_evaluation',
  'proposal_sent',
  'nurture',
  'closed_won',
  'closed_lost',
]

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { stage } = await request.json()

    if (!VALID_STAGES.includes(stage)) {
      return Response.json({ error: 'Invalid stage' }, { status: 400 })
    }

    await updateCRMStage(id, stage)
    return Response.json({ success: true })
  } catch (error) {
    console.error('PATCH /api/leads/[id]/stage error:', error)
    return Response.json({ error: 'Failed to update stage' }, { status: 500 })
  }
}
