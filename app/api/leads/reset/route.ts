import { deletePendingLeads } from '@/lib/db'
import { generateLeads } from '@/lib/generate-leads'

export async function POST() {
  try {
    const deleted = await deletePendingLeads()
    const generated = await generateLeads(20)
    return Response.json({ deleted, generated })
  } catch (error) {
    console.error('POST /api/leads/reset error:', error)
    return Response.json({ error: 'Reset failed', detail: String(error) }, { status: 500 })
  }
}
