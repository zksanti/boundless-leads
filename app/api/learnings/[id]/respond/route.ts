import type { NextRequest } from 'next/server'
import { respondToLearning } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { status, feedback } = await request.json()

    if (!['accepted', 'rejected'].includes(status)) {
      return Response.json({ error: 'Invalid status' }, { status: 400 })
    }

    await respondToLearning(id, status, feedback ?? '')
    return Response.json({ success: true })
  } catch (error) {
    console.error('POST /api/learnings/[id]/respond error:', error)
    return Response.json({ error: 'Failed to respond to learning' }, { status: 500 })
  }
}
