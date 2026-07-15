import type { NextRequest } from 'next/server'
import { updateSegment } from '@/lib/db'
import { SEGMENTS } from '@/lib/segments'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { segment } = await request.json()
    if (segment !== '' && !(segment in SEGMENTS)) {
      return Response.json({ error: 'Invalid segment' }, { status: 400 })
    }
    await updateSegment(id, segment)
    return Response.json({ ok: true })
  } catch (error) {
    console.error('PATCH /api/leads/[id]/segment error:', error)
    return Response.json({ error: 'Failed to update segment' }, { status: 500 })
  }
}
