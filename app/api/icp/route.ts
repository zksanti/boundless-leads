import { getICPProfilesBySegment, getLearningEventCounts, setupDatabase } from '@/lib/db'
import { SEGMENT_KEYS } from '@/lib/segments'

export async function GET() {
  try {
    await setupDatabase()
    const profiles = await getICPProfilesBySegment()
    const eventCounts: Record<string, Awaited<ReturnType<typeof getLearningEventCounts>>> = {}
    for (const segment of SEGMENT_KEYS) {
      eventCounts[segment] = await getLearningEventCounts(segment)
    }
    return Response.json({ profiles, eventCounts })
  } catch (error) {
    console.error('GET /api/icp error:', error)
    return Response.json({ error: 'Failed to load ICP profiles' }, { status: 500 })
  }
}
