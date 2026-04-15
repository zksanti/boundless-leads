import type { NextRequest } from 'next/server'
import { deactivateRefinement } from '@/lib/db'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await deactivateRefinement(id)
    return Response.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/patterns/refinements/[id] error:', error)
    return Response.json({ error: 'Failed to remove refinement' }, { status: 500 })
  }
}
