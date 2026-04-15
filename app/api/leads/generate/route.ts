import { generateLeads } from '@/lib/generate-leads'

export const maxDuration = 300

export async function POST() {
  try {
    console.log('generate-leads: starting generation of 20 leads')
    const count = await generateLeads(20)
    console.log(`generate-leads: inserted ${count} leads`)
    return Response.json({ count })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('POST /api/leads/generate error:', msg)
    return Response.json({ error: 'Failed to generate leads', detail: msg }, { status: 500 })
  }
}
