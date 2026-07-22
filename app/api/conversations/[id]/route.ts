import type { NextRequest } from 'next/server'
import { deleteConversation } from '@/lib/db'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await deleteConversation(id)
    return Response.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/conversations/[id] error:', error)
    return Response.json({ error: 'Failed to delete conversation' }, { status: 500 })
  }
}
