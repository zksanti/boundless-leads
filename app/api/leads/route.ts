import type { NextRequest } from 'next/server'
import { getPendingLeads, createManualLead, insertContact, setupDatabase } from '@/lib/db'
import { SEGMENTS } from '@/lib/segments'
import { WORKLOADS } from '@/lib/workloads'

export async function GET() {
  try {
    const leads = await getPendingLeads(20)
    return Response.json(leads)
  } catch (error) {
    console.error('GET /api/leads error:', error)
    return Response.json({ error: 'Failed to fetch leads' }, { status: 500 })
  }
}

// Manual pipeline entry from the CRM ("+ Add" on a segment band).
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const name = (body.company_name ?? '').trim()
    if (!name) return Response.json({ error: 'Company name required' }, { status: 400 })
    if (body.segment && !(body.segment in SEGMENTS)) {
      return Response.json({ error: 'Invalid segment' }, { status: 400 })
    }

    await setupDatabase()

    const lead = await createManualLead({
      company_name: name,
      website_url: (body.website_url ?? '').trim(),
      company_linkedin_url: (body.company_linkedin_url ?? '').trim(),
      description: (body.description ?? '').trim(),
      signal: (body.signal ?? '').trim(),
      use_case: body.use_case in WORKLOADS ? body.use_case : 'batch',
      segment: body.segment ?? '',
      tier: body.tier === 2 ? 2 : 1,
      company_size: (body.company_size ?? '').trim(),
      funding: (body.funding ?? '').trim(),
      why_boundless_fits: (body.why_boundless_fits ?? '').trim(),
    })

    const contacts = []
    const c = body.contact
    if (c?.name?.trim()) {
      contacts.push(await insertContact({
        lead_id: lead.id,
        name: c.name.trim(),
        title: (c.title ?? '').trim(),
        email: (c.email ?? '').trim(),
        linkedin_url: (c.linkedin_url ?? '').trim(),
        twitter_url: '',
        is_primary: true,
      }))
    }

    return Response.json({ lead: { ...lead, contacts, outreach: [] } })
  } catch (error) {
    console.error('POST /api/leads error:', error)
    return Response.json({ error: 'Failed to create lead' }, { status: 500 })
  }
}
