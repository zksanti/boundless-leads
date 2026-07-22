import type { NextRequest } from 'next/server'
import { saveRejectionReason } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { reason } = await request.json()

    if (!reason?.trim()) {
      return Response.json({ error: 'Missing reason' }, { status: 400 })
    }

    await saveRejectionReason(id, reason.trim())
    return Response.json({ success: true })
  } catch (error) {
    console.error('POST /api/leads/[id]/rejection-reason error:', error)
    return Response.json({ error: 'Failed to save rejection reason' }, { status: 500 })
  }
}
