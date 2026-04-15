import type { NextRequest } from 'next/server'
import { getLeadById, getReportForLead, insertOutreach } from '@/lib/db'
import { generateReport } from '@/lib/generate-report'
import { neon } from '@neondatabase/serverless'

export const maxDuration = 300

const sql = neon(process.env.POSTGRES_URL!)

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const report = await getReportForLead(id)
    return Response.json({ report })
  } catch (error) {
    console.error('GET /api/leads/[id]/report error:', error)
    return Response.json({ error: 'Failed to fetch report' }, { status: 500 })
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const lead = await getLeadById(id)
    if (!lead) return Response.json({ error: 'Lead not found' }, { status: 404 })

    const contactRows = await sql`SELECT * FROM contacts WHERE lead_id = ${id} ORDER BY is_primary DESC`

    const content = await generateReport(lead, contactRows as import('@/lib/types').Contact[])
    if (!content) return Response.json({ error: 'Generation failed' }, { status: 500 })

    await insertOutreach({ lead_id: id, contact_id: null, type: 'research_report', content })
    return Response.json({ content })
  } catch (error) {
    console.error('POST /api/leads/[id]/report error:', error)
    return Response.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
