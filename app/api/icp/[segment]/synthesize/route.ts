import type { NextRequest } from 'next/server'
import { getPendingICPProfile, saveICPProfileDraft } from '@/lib/db'
import { synthesizeICPProfile } from '@/lib/generate-icp-profile'
import { SEGMENTS } from '@/lib/segments'
import type { Segment } from '@/lib/types'

export const maxDuration = 60

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ segment: string }> }
) {
  try {
    const { segment } = await params

    if (!(segment in SEGMENTS)) {
      return Response.json({ error: 'Invalid segment' }, { status: 400 })
    }

    // One pending draft per segment — respond to it before re-synthesizing
    const existing = await getPendingICPProfile(segment)
    if (existing) {
      return Response.json({ error: 'A pending draft already exists for this segment', profile: existing }, { status: 409 })
    }

    const draft = await synthesizeICPProfile(segment as Segment)
    if (!draft) {
      return Response.json({ error: 'Synthesis failed' }, { status: 500 })
    }

    const profile = await saveICPProfileDraft(segment, draft)
    return Response.json({ profile })
  } catch (error) {
    console.error('POST /api/icp/[segment]/synthesize error:', error)
    return Response.json({ error: 'Failed to synthesize profile' }, { status: 500 })
  }
}
