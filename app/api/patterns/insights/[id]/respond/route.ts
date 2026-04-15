import type { NextRequest } from 'next/server'
import { respondToInsight, saveRefinement } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { status, feedback, refinement } = await request.json()

    if (!['accepted', 'rejected'].includes(status)) {
      return Response.json({ error: 'Invalid status' }, { status: 400 })
    }

    await respondToInsight(id, status, feedback ?? '')

    // If accepted, save refinement to inject into future generations
    if (status === 'accepted' && refinement) {
      await saveRefinement(refinement, 'ai')
    }

    // If user added manual feedback, save that too
    if (feedback?.trim()) {
      await saveRefinement(feedback.trim(), 'manual')
    }

    return Response.json({ success: true })
  } catch (error) {
    console.error('POST /api/patterns/insights/[id]/respond error:', error)
    return Response.json({ error: 'Failed to respond to insight' }, { status: 500 })
  }
}
