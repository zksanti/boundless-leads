import { getPatterns } from '@/lib/db'

export async function GET() {
  try {
    const patterns = await getPatterns()
    return Response.json(patterns)
  } catch (error) {
    console.error('GET /api/patterns error:', error)
    return Response.json({ error: 'Failed to fetch patterns' }, { status: 500 })
  }
}
