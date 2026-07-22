'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import SwipeDeck from '@/components/SwipeDeck'
import { REJECTION_PRESETS } from '@/lib/taxonomy'
import type { Lead } from '@/lib/types'

// Real-time "why did you pass?" popup shown immediately after a left swipe.
// Toggleable from the Learnings page (ask_rejection_reason setting) — off by
// default feels invasive to some workflows, so it can be switched off there.
function RejectionReasonModal({
  lead,
  onDone,
}: {
  lead: { id: string; name: string }
  onDone: () => void
}) {
  const [custom, setCustom] = useState('')

  const submit = (reason: string) => {
    if (!reason.trim()) return
    fetch(`/api/leads/${lead.id}/rejection-reason`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason.trim() }),
    })
    onDone()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDone])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 px-4 pb-6 sm:pb-4" onClick={onDone}>
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-medium text-gray-900">Why wasn&apos;t this the best fit?</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Passed on <span className="font-medium text-gray-700">{lead.name}</span>
            </p>
          </div>
          <button onClick={onDone} className="flex-shrink-0 text-gray-300 hover:text-gray-500 text-lg leading-none">
            ✕
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {REJECTION_PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => submit(preset)}
              className="px-3 py-1.5 text-sm rounded-full border border-gray-200 text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-colors"
            >
              {preset}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit(custom)
          }}
          className="mt-3 flex gap-2"
        >
          <input
            autoFocus
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Or type your own reason"
            className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:border-gray-300 outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={!custom.trim()}
            className="px-4 py-2 text-sm font-medium rounded-full bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40 transition-colors"
          >
            Send
          </button>
        </form>

        <button onClick={onDone} className="mt-3 text-xs text-gray-400 hover:text-gray-600 transition-colors">
          Skip
        </button>
      </div>
    </div>
  )
}

export default function HomePage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRejected, setLastRejected] = useState<{ id: string; name: string } | null>(null)
  const [askRejectionReason, setAskRejectionReason] = useState(false)
  const generatingRef = useRef(false)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => setAskRejectionReason(data.ask_rejection_reason !== 'off'))
      .catch(() => setAskRejectionReason(true))
  }, [])

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch('/api/leads')
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setLeads(data)
      setError(null)
    } catch {
      setError('Could not connect to the database.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadMore = useCallback(async (force = false) => {
    if (!force && generatingRef.current) return
    generatingRef.current = true
    setIsGenerating(true)
    try {
      const genRes = await fetch('/api/leads/generate', { method: 'POST' })
      if (!genRes.ok) {
        const err = await genRes.text()
        console.error('Generate failed:', genRes.status, err)
      } else {
        const data = await genRes.json()
        console.log('Generated:', data)
      }
      const res = await fetch('/api/leads')
      if (res.ok) setLeads(await res.json())
    } catch (err) {
      console.error('loadMore error:', err)
    } finally {
      setIsGenerating(false)
      generatingRef.current = false
    }
  }, [])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  // Proactively load more when deck gets low
  useEffect(() => {
    if (!isLoading && leads.length <= 2 && !generatingRef.current) {
      loadMore()
    }
  }, [leads.length, isLoading, loadMore])

  const resetDeck = useCallback(async () => {
    setIsResetting(true)
    setLeads([])
    try {
      await fetch('/api/leads/reset', { method: 'POST' })
      const res = await fetch('/api/leads')
      if (res.ok) setLeads(await res.json())
    } finally {
      setIsResetting(false)
    }
  }, [])

  const handleSwipe = useCallback(
    async (leadId: string, direction: 'right' | 'left' | 'down') => {
      setLeads((prev) => {
        const lead = prev.find((l) => l.id === leadId)
        // A new swipe replaces (left) or dismisses (right/down) the reason popup
        setLastRejected(
          direction === 'left' && lead && askRejectionReason ? { id: leadId, name: lead.company_name } : null
        )
        return prev.filter((l) => l.id !== leadId)
      })
      fetch('/api/leads/swipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, direction }),
      })
    },
    [askRejectionReason]
  )

  if (error) {
    return (
      <main className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center">
        <p className="text-gray-500 mb-6 max-w-xs">
          Database not connected.{' '}
          <span className="text-gray-400">
            Set up your Vercel Postgres database, then initialize it below.
          </span>
        </p>
        <button
          onClick={async () => {
            setError(null)
            setIsLoading(true)
            await fetch('/api/setup', { method: 'POST' })
            await fetchLeads()
          }}
          className="px-6 py-3 bg-gray-900 text-white rounded-full text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          Initialize database
        </button>
      </main>
    )
  }

  return (
    <main className="flex flex-col items-center px-4 pt-6 pb-10">
      <div className="w-full max-w-sm">
        {/* Count */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-gray-900">Today&apos;s Leads</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {isLoading
                ? 'Loading...'
                : isResetting
                  ? 'Clearing old leads...'
                  : `${leads.length} in deck${isGenerating ? ' · finding more' : ''}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={resetDeck}
              disabled={isGenerating || isResetting}
              className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-40 transition-colors"
              title="Clear old leads and generate fresh ones"
            >
              {isResetting ? 'Resetting...' : 'Reset deck'}
            </button>
            <button
              onClick={() => loadMore(true)}
              disabled={isGenerating || isResetting}
              className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-40 transition-colors"
            >
              {isGenerating ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        <SwipeDeck
          leads={leads}
          onSwipe={handleSwipe}
          onEmpty={() => loadMore(true)}
          isLoading={isLoading}
          isGenerating={isGenerating}
        />

        {lastRejected && (
          <RejectionReasonModal lead={lastRejected} onDone={() => setLastRejected(null)} />
        )}
      </div>
    </main>
  )
}
