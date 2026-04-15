import type { NextRequest } from 'next/server'
import { saveRefinement } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { content } = await request.json()
    if (!content?.trim()) return Response.json({ error: 'Content required' }, { status: 400 })
    const refinement = await saveRefinement(content.trim(), 'manual')
    return Response.json({ refinement })
  } catch (error) {
    console.error('POST /api/patterns/refinements error:', error)
    return Response.json({ error: 'Failed to save refinement' }, { status: 500 })
  }
}
