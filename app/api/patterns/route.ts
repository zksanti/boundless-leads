import { setupDatabase, getPatterns, getTotalSwipeCount, getPendingInsight, getActiveRefinements } from '@/lib/db'

export async function GET() {
  try {
    await setupDatabase()
    const [patterns, swipeCount, pendingInsight, refinements] = await Promise.all([
      getPatterns(),
      getTotalSwipeCount(),
      getPendingInsight(),
      getActiveRefinements(),
    ])
    return Response.json({ patterns, swipeCount, pendingInsight, refinements })
  } catch (error) {
    console.error('GET /api/patterns error:', error)
    return Response.json({ error: 'Failed to fetch patterns' }, { status: 500 })
  }
}
