import type { NextRequest } from 'next/server'
import { setOutreachChannel } from '@/lib/db'
import type { OutreachChannel } from '@/lib/types'

const VALID: OutreachChannel[] = ['linkedin', 'x', 'telegram']

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { channel } = await request.json()
    if (!VALID.includes(channel)) {
      return Response.json({ error: 'Invalid channel' }, { status: 400 })
    }
    await setOutreachChannel(id, channel)
    return Response.json({ success: true })
  } catch (error) {
    console.error('PATCH /api/leads/[id]/channel error:', error)
    return Response.json({ error: 'Failed to set channel' }, { status: 500 })
  }
}
