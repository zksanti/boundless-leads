'use client'

import { useState, useEffect } from 'react'
import type { Pattern } from '@/lib/types'

const USE_CASE_LABEL: Record<string, string> = {
  payments: 'Payments',
  yield: 'Yield',
  treasury: 'Treasury',
  tokenization: 'Tokenization',
}

const USE_CASE_COLOR: Record<string, string> = {
  payments: 'bg-blue-500',
  yield: 'bg-emerald-500',
  treasury: 'bg-violet-500',
  tokenization: 'bg-amber-500',
}

export default function PatternsPage() {
  const [patterns, setPatterns] = useState<Pattern[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/patterns')
      .then((r) => r.json())
      .then((data) => {
        setPatterns(Array.isArray(data) ? data : [])
        setIsLoading(false)
      })
      .catch(() => setIsLoading(false))
  }, [])

  const totalSwipes = patterns.reduce((sum, p) => sum + p.right_swipes + p.left_swipes, 0)
  const totalMatches = patterns.reduce((sum, p) => sum + p.right_swipes, 0)

  // Group by use case
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

  if (totalSwipes === 0) {
    return (
      <main className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <p className="text-gray-500">No swipe data yet.</p>
        <p className="text-sm text-gray-400 mt-1">
          Pattern learning kicks in after your first few swipes.
        </p>
      </main>
    )
  }

  return (
    <main className="max-w-xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-base font-semibold text-gray-900">What you&apos;re approving</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          {totalSwipes} swipes · {totalMatches} matched · lead generation adapts to these patterns
        </p>
      </div>

      {/* Use case breakdown */}
      <div className="flex flex-col gap-4 mb-8">
        {byUseCase
          .filter((uc) => uc.total > 0)
          .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))
          .map((uc) => (
            <div key={uc.use_case} className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-gray-900">
                  {USE_CASE_LABEL[uc.use_case] ?? uc.use_case}
                </span>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-emerald-600 font-medium">{uc.right} ♥</span>
                  <span className="text-red-400">{uc.left} ✕</span>
                  {uc.rate !== null && (
                    <span className="text-gray-500 font-semibold">{uc.rate}%</span>
                  )}
                </div>
              </div>

              {/* Bar */}
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${USE_CASE_COLOR[uc.use_case] ?? 'bg-gray-400'} transition-all`}
                  style={{ width: `${uc.rate ?? 0}%` }}
                />
              </div>

              {/* Tier breakdown */}
              {uc.tiers.some((t) => t.right_swipes + t.left_swipes > 0) && (
                <div className="mt-3 flex gap-4">
                  {uc.tiers.map((t) => {
                    const total = t.right_swipes + t.left_swipes
                    if (total === 0) return null
                    const rate = Math.round((t.right_swipes / total) * 100)
                    return (
                      <div key={t.tier} className="text-xs text-gray-400">
                        Tier {t.tier}: {rate}% ({t.right_swipes}/{total})
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
      </div>

      {/* Summary note */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <p className="text-xs text-gray-500 leading-relaxed">
          Lead generation uses these approval rates to weight searches. After ~20 swipes the
          pattern is strong enough to meaningfully bias the deck toward what you&apos;re approving.
        </p>
      </div>
    </main>
  )
}
