import type { NextRequest } from 'next/server'
import { insertContact } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { name, title, linkedin_url, twitter_url } = await request.json()
    if (!name?.trim()) return Response.json({ error: 'Name required' }, { status: 400 })
    const contact = await insertContact({
      lead_id: id,
      name: name.trim(),
      title: title?.trim() ?? '',
      linkedin_url: linkedin_url?.trim() ?? '',
      twitter_url: twitter_url?.trim() ?? '',
      is_primary: false,
    })
    return Response.json({ contact })
  } catch (error) {
    console.error('POST /api/leads/[id]/contacts error:', error)
    return Response.json({ error: 'Failed to add contact' }, { status: 500 })
  }
}
