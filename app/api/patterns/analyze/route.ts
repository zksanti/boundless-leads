import { getSwipedLeadsForAnalysis, getInsightForMilestone, saveInsight, saveRefinement, getTotalSwipeCount } from '@/lib/db'
import { generateInsight } from '@/lib/generate-insight'

export const maxDuration = 60

export async function POST() {
  try {
    const swipeCount = await getTotalSwipeCount()
    const milestone = Math.floor(swipeCount / 20) * 20

    if (milestone < 20) {
      return Response.json({ error: 'Not enough swipes yet (need 20)' }, { status: 400 })
    }

    // Don't regenerate if one already exists for this milestone
    const existing = await getInsightForMilestone(milestone)
    if (existing) {
      return Response.json({ insight: existing, alreadyExists: true })
    }

    const { accepted, rejected } = await getSwipedLeadsForAnalysis()
    const result = await generateInsight(accepted, rejected)

    if (!result) {
      return Response.json({ error: 'Generation failed' }, { status: 500 })
    }

    const insight = await saveInsight(milestone, result.insight, result.refinement)
    return Response.json({ insight })
  } catch (error) {
    console.error('POST /api/patterns/analyze error:', error)
    return Response.json({ error: 'Failed to analyze patterns' }, { status: 500 })
  }
}
