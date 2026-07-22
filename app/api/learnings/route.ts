import type { NextRequest } from 'next/server'
import { getLearnings, insertLearning, getResponseTagAggregates, setupDatabase } from '@/lib/db'
import { SEGMENTS } from '@/lib/segments'
import { isBannedMessagingLearning } from '@/lib/analyze-conversation'

export async function GET() {
  try {
    await setupDatabase()
    const [all, tagAggregates] = await Promise.all([
      getLearnings(),
      getResponseTagAggregates(),
    ])
    return Response.json({
      pending: all.filter((l) => l.status === 'pending'),
      icp: all.filter((l) => l.status === 'accepted' && l.category === 'icp'),
      messaging: all.filter((l) => l.status === 'accepted' && l.category === 'messaging'),
      tagAggregates,
    })
  } catch (error) {
    console.error('GET /api/learnings error:', error)
    return Response.json({ error: 'Failed to load learnings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { category, segment, content } = await request.json()

    if (!['icp', 'messaging'].includes(category)) {
      return Response.json({ error: 'Invalid category' }, { status: 400 })
    }
    if (segment !== '' && !(segment in SEGMENTS)) {
      return Response.json({ error: 'Invalid segment' }, { status: 400 })
    }
    if (!content?.trim()) {
      return Response.json({ error: 'Missing content' }, { status: 400 })
    }
    if (category === 'messaging' && isBannedMessagingLearning(content)) {
      return Response.json(
        { error: 'Messaging learnings cannot contain cost percentages, "cheap(er)", customer-result claims, or em dashes' },
        { status: 400 }
      )
    }

    // Manual learnings are the user's own words — they apply immediately
    const learning = await insertLearning({
      category,
      segment,
      content: content.trim(),
      source: 'manual',
      status: 'accepted',
    })
    return Response.json({ learning })
  } catch (error) {
    console.error('POST /api/learnings error:', error)
    return Response.json({ error: 'Failed to save learning' }, { status: 500 })
  }
}
