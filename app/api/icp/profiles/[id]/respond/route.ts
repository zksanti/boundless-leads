import type { NextRequest } from 'next/server'
import { respondToICPProfile, getICPProfileById, getActiveRefinements, deactivateRefinement } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { status } = await request.json()

    if (!['accepted', 'rejected'].includes(status)) {
      return Response.json({ error: 'Invalid status' }, { status: 400 })
    }

    const profile = await getICPProfileById(id)
    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 })
    }

    await respondToICPProfile(id, status)

    // Accepting a profile folds the AI-sourced flat refinements into it, so
    // deactivate them to avoid double-injection. Manual refinements survive —
    // they are the user's own words, not synthesis input.
    if (status === 'accepted') {
      const refinements = await getActiveRefinements()
      for (const r of refinements) {
        if (r.source === 'ai') await deactivateRefinement(r.id)
      }
    }

    return Response.json({ success: true })
  } catch (error) {
    console.error('POST /api/icp/profiles/[id]/respond error:', error)
    return Response.json({ error: 'Failed to respond to profile' }, { status: 500 })
  }
}
