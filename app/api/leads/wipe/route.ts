import { wipeDatabase } from '@/lib/db'
import { generateLeads } from '@/lib/generate-leads'

export const maxDuration = 300

// DESTRUCTIVE: clears every lead, contact, outreach, learned pattern, insight,
// and refinement, then reseeds the workload taxonomy and generates a fresh deck.
// Used once when repointing the tool at a new product/ICP. Not wired to the
// routine "Reset deck" button — call this explicitly.
export async function POST() {
  try {
    const wiped = await wipeDatabase()
    const generated = await generateLeads(20)
    return Response.json({ wiped, generated })
  } catch (error) {
    console.error('POST /api/leads/wipe error:', error)
    return Response.json({ error: 'Wipe failed', detail: String(error) }, { status: 500 })
  }
}
