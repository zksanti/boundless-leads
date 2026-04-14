'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import SwipeDeck from '@/components/SwipeDeck'
import type { Lead } from '@/lib/types'

export default function HomePage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const generatingRef = useRef(false)

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

  const loadMore = useCallback(async () => {
    if (generatingRef.current) return
    generatingRef.current = true
    setIsGenerating(true)
    try {
      await fetch('/api/leads/generate', { method: 'POST' })
      const res = await fetch('/api/leads')
      if (res.ok) setLeads(await res.json())
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
      setLeads((prev) => prev.filter((l) => l.id !== leadId))
      fetch('/api/leads/swipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, direction }),
      })
    },
    []
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
          className="px-6 py-3 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
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
              onClick={loadMore}
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
          onEmpty={loadMore}
          isLoading={isLoading}
          isGenerating={isGenerating}
        />
      </div>
    </main>
  )
}
