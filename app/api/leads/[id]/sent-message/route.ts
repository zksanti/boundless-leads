import type { NextRequest } from 'next/server'
import { saveSentMessage } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { content } = await request.json()
    if (!content?.trim()) {
      return Response.json({ error: 'Content required' }, { status: 400 })
    }
    const outreach = await saveSentMessage(id, content.trim())
    return Response.json({ outreach })
  } catch (error) {
    console.error('POST /api/leads/[id]/sent-message error:', error)
    return Response.json({ error: 'Failed to save message' }, { status: 500 })
  }
}
