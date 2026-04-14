import type { NextRequest } from 'next/server'
import { getLeadById, getContactById, insertOutreach } from '@/lib/db'
import { generateOutreach } from '@/lib/generate-outreach'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params
    const body = await request.json()
    const contactId: string | null = body.contactId || null

    const lead = await getLeadById(leadId)
    if (!lead) {
      return Response.json({ error: 'Lead not found' }, { status: 404 })
    }

    const contact = contactId ? await getContactById(contactId) : null

    const outreach = await generateOutreach(lead, contact)

    // Persist each type
    const types = ['linkedin_connection', 'linkedin_dm', 'email'] as const
    for (const type of types) {
      const content = outreach[type]
      if (content) {
        await insertOutreach({ lead_id: leadId, contact_id: contactId, type, content })
      }
    }

    return Response.json({ outreach })
  } catch (error) {
    console.error('POST /api/outreach error:', error)
    return Response.json({ error: 'Failed to generate outreach' }, { status: 500 })
  }
}
