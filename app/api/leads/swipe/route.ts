import { recordSwipe } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const { leadId, direction } = await request.json()

    if (!leadId || !direction) {
      return Response.json({ error: 'Missing leadId or direction' }, { status: 400 })
    }
    if (!['right', 'left', 'down'].includes(direction)) {
      return Response.json({ error: 'Invalid direction' }, { status: 400 })
    }

    await recordSwipe(leadId, direction)
    return Response.json({ success: true })
  } catch (error) {
    console.error('POST /api/leads/swipe error:', error)
    return Response.json({ error: 'Failed to record swipe' }, { status: 500 })
  }
}
