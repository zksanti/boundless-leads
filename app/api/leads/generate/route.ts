import { generateLeads } from '@/lib/generate-leads'

export const maxDuration = 300

export async function POST() {
  try {
    const count = await generateLeads(20)
    return Response.json({ count })
  } catch (error) {
    console.error('POST /api/leads/generate error:', error)
    return Response.json({ error: 'Failed to generate leads' }, { status: 500 })
  }
}
