import type { NextRequest } from 'next/server'
import { generateLeads } from '@/lib/generate-leads'
import { SEGMENTS } from '@/lib/segments'
import type { Segment } from '@/lib/types'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const requested = typeof body?.count === 'number' ? Math.min(Math.max(body.count, 1), 30) : 20
    const segment: Segment | undefined =
      typeof body?.segment === 'string' && body.segment in SEGMENTS ? (body.segment as Segment) : undefined
    console.log(`generate-leads: starting generation of ${requested} leads${segment ? ` for segment ${segment}` : ''}`)
    const count = await generateLeads(requested, segment)
    console.log(`generate-leads: inserted ${count} leads`)
    return Response.json({ count })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('POST /api/leads/generate error:', msg)
    return Response.json({ error: 'Failed to generate leads', detail: msg }, { status: 500 })
  }
}
