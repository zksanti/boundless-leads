import { getPendingLeads } from '@/lib/db'

export async function GET() {
  try {
    const leads = await getPendingLeads(20)
    return Response.json(leads)
  } catch (error) {
    console.error('GET /api/leads error:', error)
    return Response.json({ error: 'Failed to fetch leads' }, { status: 500 })
  }
}
