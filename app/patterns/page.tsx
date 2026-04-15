'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Pattern, PatternInsight, SearchRefinement } from '@/lib/types'

const USE_CASE_COLOR: Record<string, string> = {
  payments:     'bg-blue-500',
  yield:        'bg-emerald-500',
  treasury:     'bg-violet-500',
  tokenization: 'bg-amber-500',
}

const USE_CASE_LABEL: Record<string, string> = {
  payments: 'Payments', yield: 'Yield', treasury: 'Treasury', tokenization: 'Tokenization',
}

function InsightCard({
  insight,
  onAccept,
  onReject,
}: {
  insight: PatternInsight
  onAccept: (feedback: string) => void
  onReject: (feedback: string) => void
}) {
  const [feedback, setFeedback] = useState('')
  const [responding, setResponding] = useState(false)

  const handle = async (status: 'accepted' | 'rejected') => {
    setResponding(true)
    if (status === 'accepted') onAccept(feedback)
    else onReject(feedback)
  }

  return (
    <div className="bg-white border-2 border-violet-200 rounded-2xl p-5 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
        <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide">
          Pattern update · based on your last {insight.swipe_milestone} swipes
        </p>
      </div>

      <p className="text-sm text-gray-800 leading-relaxed mb-4">{insight.insight}</p>

      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
        Would you like to refine your search with this?
      </p>

      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Add your own thoughts or adjustments (optional)..."
        rows={2}
        className="w-full text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-gray-300 mb-3"
      />

      <div className="flex gap-2">
        <button
          onClick={() => handle('accepted')}
          disabled={responding}
          className="flex-1 h-9 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          Yes, refine my search
        </button>
        <button
          onClick={() => handle('rejected')}
          disabled={responding}
          className="h-9 px-4 border border-gray-200 text-sm text-gray-600 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}

export default function PatternsPage() {
  const [patterns, setPatterns] = useState<Pattern[]>([])
  const [swipeCount, setSwipeCount] = useState(0)
  const [pendingInsight, setPendingInsight] = useState<PatternInsight | null>(null)
  const [refinements, setRefinements] = useState<SearchRefinement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [manualFeedback, setManualFeedback] = useState('')
  const [savingManual, setSavingManual] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/patterns')
    if (!res.ok) { setIsLoading(false); return }
    const data = await res.json()
    setPatterns(data.patterns ?? [])
    setSwipeCount(data.swipeCount ?? 0)
    setPendingInsight(data.pendingInsight ?? null)
    setRefinements(data.refinements ?? [])
    setIsLoading(false)
  }, [])

  // Auto-analyze when milestone is reached and no pending insight
  const maybeAutoAnalyze = useCallback(async (count: number, existing: PatternInsight | null) => {
    const milestone = Math.floor(count / 20) * 20
    if (milestone < 20 || existing) return
    setIsAnalyzing(true)
    try {
      const res = await fetch('/api/patterns/analyze', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        if (data.insight) setPendingInsight(data.insight)
      }
    } finally {
      setIsAnalyzing(false)
    }
  }, [])

  useEffect(() => {
    load().then(() => {
      // After load, check if we should auto-analyze
      // We read from the state setters directly via callbacks
    })
  }, [load])

  // Separate effect that fires once data is loaded
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    if (!isLoading && !loaded) {
      setLoaded(true)
      maybeAutoAnalyze(swipeCount, pendingInsight)
    }
  }, [isLoading, loaded, swipeCount, pendingInsight, maybeAutoAnalyze])

  const handleInsightResponse = async (status: 'accepted' | 'rejected', feedback: string) => {
    if (!pendingInsight) return
    await fetch(`/api/patterns/insights/${pendingInsight.id}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, feedback, refinement: pendingInsight.refinement }),
    })
    setPendingInsight(null)
    if (status === 'accepted') {
      const newRef: SearchRefinement = {
        id: '', content: pendingInsight.refinement, source: 'ai',
        created_at: new Date().toISOString(), active: true,
      }
      setRefinements((prev) => [newRef, ...prev])
    }
    if (feedback.trim()) {
      const manualRef: SearchRefinement = {
        id: '', content: feedback.trim(), source: 'manual',
        created_at: new Date().toISOString(), active: true,
      }
      setRefinements((prev) => [manualRef, ...prev])
    }
  }

  const saveManual = async () => {
    if (!manualFeedback.trim()) return
    setSavingManual(true)
    try {
      const res = await fetch('/api/patterns/refinements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: manualFeedback.trim() }),
      })
      if (res.ok) {
        const { refinement } = await res.json()
        setRefinements((prev) => [refinement, ...prev])
        setManualFeedback('')
      }
    } finally {
      setSavingManual(false)
    }
  }

  const removeRefinement = async (id: string) => {
    await fetch(`/api/patterns/refinements/${id}`, { method: 'DELETE' })
    setRefinements((prev) => prev.filter((r) => r.id !== id))
  }

  const totalSwipes = patterns.reduce((s, p) => s + p.right_swipes + p.left_swipes, 0)
  const totalMatches = patterns.reduce((s, p) => s + p.right_swipes, 0)
  const nextMilestone = (Math.floor(swipeCount / 20) + 1) * 20

  const byUseCase = ['payments', 'yield', 'treasury', 'tokenization'].map((uc) => {
    const rows = patterns.filter((p) => p.use_case === uc)
    const right = rows.reduce((s, p) => s + p.right_swipes, 0)
    const left = rows.reduce((s, p) => s + p.left_swipes, 0)
    const total = right + left
    const rate = total > 0 ? Math.round((right / total) * 100) : null
    return { use_case: uc, right, left, total, rate, tiers: rows }
  })

  if (isLoading) {
    return (
      <main className="flex items-center justify-center min-h-[60vh]">
        <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </main>
    )
  }

  return (
    <main className="max-w-xl mx-auto px-4 py-6">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-base font-semibold text-gray-900">Patterns</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          {swipeCount} swipes · {totalMatches} matched
          {swipeCount < 20
            ? ` · pattern analysis unlocks at 20 swipes (${20 - swipeCount} to go)`
            : ` · search adapts from your swipe history`}
        </p>
      </div>

      {/* Analyzing state */}
      {isAnalyzing && (
        <div className="bg-violet-50 border border-violet-200 rounded-2xl p-5 mb-6 flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <p className="text-sm text-violet-700">Analyzing your swipe patterns...</p>
        </div>
      )}

      {/* Insight card */}
      {!isAnalyzing && pendingInsight && (
        <InsightCard
          insight={pendingInsight}
          onAccept={(fb) => handleInsightResponse('accepted', fb)}
          onReject={(fb) => handleInsightResponse('rejected', fb)}
        />
      )}

      {/* Progress to next analysis */}
      {!isAnalyzing && !pendingInsight && swipeCount >= 20 && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-6 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Next pattern analysis at {nextMilestone} swipes ({nextMilestone - swipeCount} to go)
          </p>
          <button
            onClick={() => maybeAutoAnalyze(swipeCount + 1, null)}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Analyze now
          </button>
        </div>
      )}

      {/* Swipe breakdown */}
      {totalSwipes > 0 && (
        <div className="flex flex-col gap-3 mb-8">
          {byUseCase
            .filter((uc) => uc.total > 0)
            .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))
            .map((uc) => (
              <div key={uc.use_case} className="bg-white border border-gray-200 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-gray-900 text-sm">{USE_CASE_LABEL[uc.use_case]}</span>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-emerald-600 font-medium">{uc.right} ♥</span>
                    <span className="text-red-400">{uc.left} ✕</span>
                    {uc.rate !== null && (
                      <span className="text-gray-600 font-semibold tabular-nums">{uc.rate}%</span>
                    )}
                  </div>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${USE_CASE_COLOR[uc.use_case]}`}
                    style={{ width: `${uc.rate ?? 0}%` }}
                  />
                </div>
                {uc.tiers.some((t) => t.right_swipes + t.left_swipes > 0) && (
                  <div className="mt-2.5 flex gap-4">
                    {uc.tiers.map((t) => {
                      const total = t.right_swipes + t.left_swipes
                      if (total === 0) return null
                      return (
                        <span key={t.tier} className="text-xs text-gray-400">
                          Tier {t.tier}: {Math.round((t.right_swipes / total) * 100)}% ({t.right_swipes}/{total})
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {totalSwipes === 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center mb-8">
          <p className="text-gray-500 text-sm">No swipes yet.</p>
          <p className="text-xs text-gray-400 mt-1">Pattern learning kicks in after your first few swipes.</p>
        </div>
      )}

      {/* Active refinements */}
      {refinements.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5">
            Active search guidance
          </p>
          <div className="flex flex-col gap-2">
            {refinements.map((r, i) => (
              <div
                key={r.id || i}
                className="flex items-start justify-between gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3"
              >
                <div className="flex items-start gap-2 min-w-0">
                  <span className={`mt-0.5 flex-shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${
                    r.source === 'ai' ? 'bg-violet-50 text-violet-600' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {r.source === 'ai' ? 'AI' : 'Manual'}
                  </span>
                  <p className="text-sm text-gray-700 leading-relaxed">{r.content}</p>
                </div>
                {r.id && (
                  <button
                    onClick={() => removeRefinement(r.id)}
                    className="flex-shrink-0 text-gray-300 hover:text-gray-500 text-lg leading-none mt-0.5"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manual guidance input */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5">
          Add custom search guidance
        </p>
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <textarea
            value={manualFeedback}
            onChange={(e) => setManualFeedback(e.target.value)}
            placeholder={`e.g. "Focus on EU-based fintechs facing MiCA compliance deadlines" or "Prefer companies with existing DeFi integrations rather than those just exploring"`}
            rows={3}
            className="w-full text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-gray-300 mb-3"
          />
          <button
            onClick={saveManual}
            disabled={!manualFeedback.trim() || savingManual}
            className="h-9 px-4 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 disabled:opacity-40 transition-colors"
          >
            {savingManual ? 'Saving...' : 'Add to search'}
          </button>
        </div>
      </div>

    </main>
  )
}
