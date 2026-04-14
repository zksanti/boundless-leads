import { getAcceptedLeads } from '@/lib/db'

export async function GET() {
  try {
    const leads = await getAcceptedLeads()
    return Response.json(leads)
  } catch (error) {
    console.error('GET /api/queue error:', error)
    return Response.json({ error: 'Failed to fetch queue' }, { status: 500 })
  }
}
