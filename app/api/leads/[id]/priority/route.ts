import type { NextRequest } from 'next/server'
import { togglePriority } from '@/lib/db'

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const is_priority = await togglePriority(id)
    return Response.json({ is_priority })
  } catch (error) {
    console.error('PATCH /api/leads/[id]/priority error:', error)
    return Response.json({ error: 'Failed to toggle priority' }, { status: 500 })
  }
}
