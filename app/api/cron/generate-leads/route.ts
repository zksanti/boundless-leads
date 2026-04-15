import { generateLeads } from '@/lib/generate-leads'
import { getPendingLeadCount } from '@/lib/db'

export const maxDuration = 300

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const pending = await getPendingLeadCount()

    // Only generate if the deck is nearly empty
    if (pending < 5) {
      const count = await generateLeads(20)
      return Response.json({ success: true, generated: count, pending: pending + count })
    }

    return Response.json({ success: true, skipped: true, pending })
  } catch (error) {
    console.error('Cron error:', error)
    return Response.json({ error: 'Cron job failed' }, { status: 500 })
  }
}
