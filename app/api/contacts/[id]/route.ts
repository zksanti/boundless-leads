import type { NextRequest } from 'next/server'
import { updateContact } from '@/lib/db'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, title, linkedin_url, twitter_url } = body
    const contact = await updateContact(id, { name, title, linkedin_url, twitter_url })
    return Response.json({ contact })
  } catch (error) {
    console.error('PATCH /api/contacts/[id] error:', error)
    return Response.json({ error: 'Failed to update contact' }, { status: 500 })
  }
}
