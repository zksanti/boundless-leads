import type { NextRequest } from 'next/server'
import { getSetting, setSetting, setupDatabase } from '@/lib/db'

const VALID: Record<string, string[]> = {
  learning_mode: ['review', 'auto'],
  ask_rejection_reason: ['on', 'off'],
}

const DEFAULTS: Record<string, string> = {
  learning_mode: 'review',
  ask_rejection_reason: 'on',
}

export async function GET() {
  try {
    await setupDatabase()
    const entries = await Promise.all(
      Object.keys(VALID).map(async (key) => [key, (await getSetting(key)) ?? DEFAULTS[key]] as const)
    )
    return Response.json(Object.fromEntries(entries))
  } catch (error) {
    console.error('GET /api/settings error:', error)
    return Response.json({ error: 'Failed to load settings' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const updates: Record<string, string> = {}

    for (const [key, value] of Object.entries(body)) {
      if (!(key in VALID)) {
        return Response.json({ error: `Unknown setting: ${key}` }, { status: 400 })
      }
      if (typeof value !== 'string' || !VALID[key].includes(value)) {
        return Response.json({ error: `Invalid value for ${key}` }, { status: 400 })
      }
      updates[key] = value
    }

    await Promise.all(Object.entries(updates).map(([key, value]) => setSetting(key, value)))
    return Response.json(updates)
  } catch (error) {
    console.error('PUT /api/settings error:', error)
    return Response.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
