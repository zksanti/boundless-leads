import { setupDatabase } from '@/lib/db'

export async function POST() {
  try {
    await setupDatabase()
    return Response.json({ success: true, message: 'Database ready' })
  } catch (error) {
    console.error('POST /api/setup error:', error)
    return Response.json({ error: 'Setup failed', detail: String(error) }, { status: 500 })
  }
}
