'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Pattern, PatternInsight, SearchRefinement, Learning, ICPProfile, LearningMode, Segment } from '@/lib/types'
import { WORKLOADS, WORKLOAD_KEYS } from '@/lib/workloads'
import { SEGMENTS, SEGMENT_KEYS } from '@/lib/segments'
import { TAG_DIAGNOSIS, DIAGNOSIS_HINTS, type DiagnosisBucket, type ResponseTag } from '@/lib/taxonomy'
import { ThinkingOrb } from 'thinking-orbs'

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
          className="flex-1 h-9 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 disabled:opacity-50 transition-colors"
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

// ─── Learning cards ────────────────────────────────────────────────────────────

const CATEGORY_CHIP: Record<string, string> = {
  icp:       'bg-violet-50 text-violet-600',
  messaging: 'bg-blue-50 text-blue-600',
}

function segmentChip(segment: string) {
  if (segment && segment in SEGMENTS) {
    const s = SEGMENTS[segment as Segment]
    return <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${s.chip}`}>{s.short}</span>
  }
  return <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-gray-100 text-gray-500">Global</span>
}

function PendingLearningCard({
  learning,
  onRespond,
}: {
  learning: Learning
  onRespond: (id: string, status: 'accepted' | 'rejected', feedback: string) => void
}) {
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  return (
    <div className="bg-white border-2 border-violet-200 rounded-2xl p-4">
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${CATEGORY_CHIP[learning.category]}`}>
          {learning.category === 'icp' ? 'ICP' : 'Messaging'}
        </span>
        {segmentChip(learning.segment)}
        <span className="text-xs text-gray-400">from a conversation</span>
      </div>
      <p className="text-sm text-gray-800 leading-relaxed mb-3">{learning.content}</p>

      {rejecting ? (
        <div className="flex flex-col gap-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this wrong? (optional, helps future analysis)"
            className="w-full text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-300"
          />
          <div className="flex gap-2">
            <button
              onClick={() => onRespond(learning.id, 'rejected', reason)}
              className="h-8 px-3 text-xs font-medium rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
            >
              Confirm reject
            </button>
            <button onClick={() => setRejecting(false)} className="h-8 px-3 text-xs text-gray-500 hover:text-gray-700">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => onRespond(learning.id, 'accepted', '')}
            className="h-8 px-4 bg-gray-900 text-white text-xs font-medium rounded-full hover:bg-gray-800 transition-colors"
          >
            Accept
          </button>
          <button
            onClick={() => setRejecting(true)}
            className="h-8 px-3 border border-gray-200 text-xs text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  )
}

// ─── ICP profiles ──────────────────────────────────────────────────────────────

function ArrayDiff({ previous, current }: { previous: string[]; current: string[] }) {
  const prevSet = new Set(previous)
  const currSet = new Set(current)
  const removed = previous.filter((item) => !currSet.has(item))
  return (
    <div className="flex flex-col gap-1">
      {current.map((item, i) => (
        <p
          key={i}
          className={`text-xs leading-snug pl-3 relative before:absolute before:left-0 ${
            prevSet.has(item) ? 'text-gray-600 before:content-["·"] before:text-gray-300' : 'text-emerald-700 before:content-["+"] before:text-emerald-500'
          }`}
        >
          {item}
        </p>
      ))}
      {removed.map((item, i) => (
        <p key={`r${i}`} className={`text-xs leading-snug pl-3 relative before:absolute before:left-0 before:content-['−'] before:text-red-400 text-red-400 line-through`}>
          {item}
        </p>
      ))}
    </div>
  )
}

function ProfileDiff({ profile, previous }: { profile: ICPProfile; previous: { qualification: string[]; exclude: string[]; signals: string[] } }) {
  return (
    <div className="flex flex-col gap-3 mt-3">
      {profile.change_summary && (
        <div className="bg-gray-50 rounded-lg px-3 py-2">
          {profile.change_summary.split('\n').map((line, i) => (
            <p key={i} className="text-xs text-gray-600 leading-relaxed">{line.replace(/^[-•]\s*/, '· ')}</p>
          ))}
        </div>
      )}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Qualification</p>
        <ArrayDiff previous={previous.qualification} current={profile.qualification} />
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Exclude</p>
        <ArrayDiff previous={previous.exclude} current={profile.exclude} />
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Signals</p>
        <ArrayDiff previous={previous.signals} current={profile.signals} />
      </div>
      {profile.guidance && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Learned guidance</p>
          <p className="text-xs text-gray-600 leading-relaxed">{profile.guidance}</p>
        </div>
      )}
    </div>
  )
}

function ICPProfileCard({
  segment,
  profiles,
  eventCounts,
  onSynthesize,
  onRespond,
}: {
  segment: Segment
  profiles: ICPProfile[]
  eventCounts: { swipes: number; rejection_reasons: number; learnings: number; tags: number } | null
  onSynthesize: (segment: Segment) => Promise<void>
  onRespond: (id: string, status: 'accepted' | 'rejected') => void
}) {
  const [synthesizing, setSynthesizing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const seg = SEGMENTS[segment]
  const active = profiles.find((p) => p.status === 'active') ?? null
  const pending = profiles.find((p) => p.status === 'pending') ?? null
  const newSignals = eventCounts
    ? eventCounts.swipes + eventCounts.rejection_reasons + eventCounts.learnings + eventCounts.tags
    : 0

  // The diff base: for a pending/active profile, the version before it — or
  // the static segments.ts definition (v0) when there is none.
  const baseFor = (p: ICPProfile) => {
    const prev = profiles.find((x) => x.version < p.version && ['active', 'superseded'].includes(x.status) && x.version === Math.max(...profiles.filter((y) => y.version < p.version && ['active', 'superseded'].includes(y.status)).map((y) => y.version), 0))
    return prev ?? { qualification: seg.researchQualification, exclude: seg.exclude, signals: seg.signals }
  }

  const handleSynthesize = async () => {
    setSynthesizing(true)
    try {
      await onSynthesize(segment)
    } finally {
      setSynthesizing(false)
    }
  }

  return (
    <div className={`bg-white border rounded-2xl p-4 ${pending ? 'border-2 border-violet-200' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${seg.chip}`}>{seg.short}</span>
          <span className="text-xs text-gray-500 font-medium">
            {active ? `ICP v${active.version}` : 'ICP v0 (experiment doc)'}
          </span>
          {newSignals > 0 && !pending && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600 font-medium">
              {newSignals} new signal{newSignals > 1 ? 's' : ''} since {active ? `v${active.version}` : 'v0'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {active && (
            <button onClick={() => setExpanded((e) => !e)} className="text-xs text-gray-400 hover:text-gray-600">
              {expanded ? 'Hide' : 'View'}
            </button>
          )}
          {!pending && (
            <button
              onClick={handleSynthesize}
              disabled={synthesizing || newSignals === 0}
              className="text-xs px-2.5 py-1 rounded-full bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40 transition-colors flex items-center gap-1.5"
              title={newSignals === 0 ? 'No new learning signals since the current version' : ''}
            >
              {synthesizing && <ThinkingOrb state="solving" size={20} theme="dark" />}
              {synthesizing ? 'Synthesizing...' : 'Re-synthesize'}
            </button>
          )}
        </div>
      </div>

      {pending && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide">
            Proposed v{pending.version} — review the changes
          </p>
          <ProfileDiff profile={pending} previous={baseFor(pending)} />
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => onRespond(pending.id, 'accepted')}
              className="h-8 px-4 bg-gray-900 text-white text-xs font-medium rounded-full hover:bg-gray-800 transition-colors"
            >
              Accept v{pending.version}
            </button>
            <button
              onClick={() => onRespond(pending.id, 'rejected')}
              className="h-8 px-3 border border-gray-200 text-xs text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Reject
            </button>
          </div>
        </div>
      )}

      {expanded && active && !pending && (
        <ProfileDiff profile={active} previous={baseFor(active)} />
      )}
    </div>
  )
}

// ─── Funnel diagnosis ──────────────────────────────────────────────────────────

function DiagnosisStrip({ aggregates }: { aggregates: Array<{ segment: string; primary_tag: string; count: number }> }) {
  const hints: Array<{ segment: Segment; bucket: DiagnosisBucket; count: number }> = []

  for (const segment of SEGMENT_KEYS) {
    const rows = aggregates.filter((a) => a.segment === segment)
    if (rows.length === 0) continue
    const buckets = new Map<DiagnosisBucket, number>()
    for (const row of rows) {
      const bucket = TAG_DIAGNOSIS[row.primary_tag as ResponseTag]
      if (!bucket) continue
      buckets.set(bucket, (buckets.get(bucket) ?? 0) + row.count)
    }
    let dominant: DiagnosisBucket | null = null
    let max = 0
    for (const [bucket, count] of buckets) {
      if (count > max) { max = count; dominant = bucket }
    }
    if (dominant && dominant !== 'positive' && max >= 3) {
      hints.push({ segment, bucket: dominant, count: max })
    }
  }

  if (hints.length === 0) return null

  return (
    <div className="mb-6">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5">Funnel diagnosis</p>
      <div className="flex flex-col gap-2">
        {hints.map((h) => (
          <div key={h.segment} className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
            <span className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${SEGMENTS[h.segment].chip}`}>
              {SEGMENTS[h.segment].short}
            </span>
            <p className="text-xs text-amber-800 leading-relaxed">
              {h.count} responses point the same way. {DIAGNOSIS_HINTS[h.bucket as Exclude<DiagnosisBucket, 'positive'>]}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function LearningsPage() {
  const [patterns, setPatterns] = useState<Pattern[]>([])
  const [swipeCount, setSwipeCount] = useState(0)
  const [pendingInsight, setPendingInsight] = useState<PatternInsight | null>(null)
  const [refinements, setRefinements] = useState<SearchRefinement[]>([])
  const [pendingLearnings, setPendingLearnings] = useState<Learning[]>([])
  const [acceptedLearnings, setAcceptedLearnings] = useState<{ icp: Learning[]; messaging: Learning[] }>({ icp: [], messaging: [] })
  const [tagAggregates, setTagAggregates] = useState<Array<{ segment: string; primary_tag: string; count: number }>>([])
  const [icpProfiles, setIcpProfiles] = useState<Record<string, ICPProfile[]>>({})
  const [eventCounts, setEventCounts] = useState<Record<string, { swipes: number; rejection_reasons: number; learnings: number; tags: number }>>({})
  const [learningMode, setLearningMode] = useState<LearningMode>('review')
  const [askRejectionReason, setAskRejectionReason] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [manualFeedback, setManualFeedback] = useState('')
  const [savingManual, setSavingManual] = useState(false)
  const [manualLearning, setManualLearning] = useState('')
  const [manualLearningCategory, setManualLearningCategory] = useState<'icp' | 'messaging'>('messaging')
  const [manualLearningSegment, setManualLearningSegment] = useState<string>('')
  const [savingManualLearning, setSavingManualLearning] = useState(false)
  const [manualLearningError, setManualLearningError] = useState('')

  const loadICP = useCallback(async () => {
    const res = await fetch('/api/icp')
    if (!res.ok) return
    const data = await res.json()
    setIcpProfiles(data.profiles ?? {})
    setEventCounts(data.eventCounts ?? {})
  }, [])

  const load = useCallback(async () => {
    const [patternsRes, learningsRes, settingsRes] = await Promise.all([
      fetch('/api/patterns'),
      fetch('/api/learnings'),
      fetch('/api/settings'),
    ])
    if (patternsRes.ok) {
      const data = await patternsRes.json()
      setPatterns(data.patterns ?? [])
      setSwipeCount(data.swipeCount ?? 0)
      setPendingInsight(data.pendingInsight ?? null)
      setRefinements(data.refinements ?? [])
    }
    if (learningsRes.ok) {
      const data = await learningsRes.json()
      setPendingLearnings(data.pending ?? [])
      setAcceptedLearnings({ icp: data.icp ?? [], messaging: data.messaging ?? [] })
      setTagAggregates(data.tagAggregates ?? [])
    }
    if (settingsRes.ok) {
      const data = await settingsRes.json()
      setLearningMode(data.learning_mode ?? 'review')
      setAskRejectionReason((data.ask_rejection_reason ?? 'on') !== 'off')
    }
    await loadICP().catch(() => {})
    setIsLoading(false)
  }, [loadICP])

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
    load()
  }, [load])

  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    if (!isLoading && !loaded) {
      setLoaded(true)
      maybeAutoAnalyze(swipeCount, pendingInsight)
    }
  }, [isLoading, loaded, swipeCount, pendingInsight, maybeAutoAnalyze])

  const handleAskRejectionReasonChange = async (on: boolean) => {
    setAskRejectionReason(on)
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ask_rejection_reason: on ? 'on' : 'off' }),
    })
  }

  const handleModeChange = async (mode: LearningMode) => {
    setLearningMode(mode)
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ learning_mode: mode }),
    })
  }

  const handleLearningResponse = async (id: string, status: 'accepted' | 'rejected', feedback: string) => {
    const learning = pendingLearnings.find((l) => l.id === id)
    setPendingLearnings((prev) => prev.filter((l) => l.id !== id))
    if (status === 'accepted' && learning) {
      setAcceptedLearnings((prev) => ({
        ...prev,
        [learning.category]: [{ ...learning, status: 'accepted' as const }, ...prev[learning.category]],
      }))
    }
    await fetch(`/api/learnings/${id}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, feedback }),
    })
  }

  const retireLearning = async (learning: Learning) => {
    setAcceptedLearnings((prev) => ({
      ...prev,
      [learning.category]: prev[learning.category].filter((l) => l.id !== learning.id),
    }))
    await fetch(`/api/learnings/${learning.id}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected', feedback: 'retired' }),
    })
  }

  const handleSynthesize = async (segment: Segment) => {
    const res = await fetch(`/api/icp/${segment}/synthesize`, { method: 'POST' })
    if (res.ok) await loadICP()
  }

  const handleProfileRespond = async (id: string, status: 'accepted' | 'rejected') => {
    await fetch(`/api/icp/profiles/${id}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    await loadICP()
  }

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

  const saveManualLearning = async () => {
    if (!manualLearning.trim()) return
    setSavingManualLearning(true)
    setManualLearningError('')
    try {
      const res = await fetch('/api/learnings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: manualLearningCategory, segment: manualLearningSegment, content: manualLearning.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setAcceptedLearnings((prev) => ({
          ...prev,
          [manualLearningCategory]: [data.learning, ...prev[manualLearningCategory]],
        }))
        setManualLearning('')
      } else {
        setManualLearningError(data.error ?? 'Failed to save')
      }
    } finally {
      setSavingManualLearning(false)
    }
  }

  const removeRefinement = async (id: string) => {
    await fetch(`/api/patterns/refinements/${id}`, { method: 'DELETE' })
    setRefinements((prev) => prev.filter((r) => r.id !== id))
  }

  const totalSwipes = patterns.reduce((s, p) => s + p.right_swipes + p.left_swipes, 0)
  const totalMatches = patterns.reduce((s, p) => s + p.right_swipes, 0)
  const nextMilestone = (Math.floor(swipeCount / 20) + 1) * 20

  const byUseCase = WORKLOAD_KEYS.map((uc) => {
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
        <ThinkingOrb state="working" size={64} theme="light" />
      </main>
    )
  }

  return (
    <main className="max-w-xl mx-auto px-4 py-6">

      {/* Header + settings toggles */}
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Learnings</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {swipeCount} swipes · {totalMatches} matched · search and outreach adapt from swipes and conversations
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Ask why on reject</span>
            <button
              onClick={() => handleAskRejectionReasonChange(!askRejectionReason)}
              title="When on, passing on a lead in the Swipe deck immediately asks why — feeds the living ICP."
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                askRejectionReason ? 'bg-gray-900' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  askRejectionReason ? 'translate-x-[18px]' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <div className="flex items-center rounded-lg border border-gray-200 p-0.5" title="Review: new learnings wait for your approval. Auto: they apply immediately.">
            {(['review', 'auto'] as LearningMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => handleModeChange(mode)}
                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                  learningMode === mode ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {mode === 'review' ? 'Review' : 'Auto-apply'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pending learnings queue */}
      {pendingLearnings.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5">
            Pending learnings ({pendingLearnings.length})
          </p>
          <div className="flex flex-col gap-2.5">
            {pendingLearnings.map((l) => (
              <PendingLearningCard key={l.id} learning={l} onRespond={handleLearningResponse} />
            ))}
          </div>
        </div>
      )}

      {/* Analyzing state */}
      {isAnalyzing && (
        <div className="bg-violet-50 border border-violet-200 rounded-2xl p-5 mb-6 flex items-center gap-3">
          <ThinkingOrb state="solving" size={20} theme="light" className="flex-shrink-0" />
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

      {/* Funnel diagnosis */}
      <DiagnosisStrip aggregates={tagAggregates} />

      {/* Living ICP per segment */}
      <div className="mb-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5">Living ICP</p>
        <div className="flex flex-col gap-2.5">
          {SEGMENT_KEYS.map((segment) => (
            <ICPProfileCard
              key={segment}
              segment={segment}
              profiles={icpProfiles[segment] ?? []}
              eventCounts={eventCounts[segment] ?? null}
              onSynthesize={handleSynthesize}
              onRespond={handleProfileRespond}
            />
          ))}
        </div>
      </div>

      {/* Accepted messaging learnings */}
      {(acceptedLearnings.messaging.length > 0 || acceptedLearnings.icp.length > 0) && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5">Accepted learnings</p>
          <div className="flex flex-col gap-2">
            {[...acceptedLearnings.messaging, ...acceptedLearnings.icp].map((l) => (
              <div key={l.id} className="flex items-start justify-between gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
                <div className="flex items-start gap-2 min-w-0 flex-wrap">
                  <span className={`mt-0.5 flex-shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${CATEGORY_CHIP[l.category]}`}>
                    {l.category === 'icp' ? 'ICP' : 'Messaging'}
                  </span>
                  {segmentChip(l.segment)}
                  {l.auto_applied && (
                    <span className="mt-0.5 flex-shrink-0 text-xs px-1.5 py-0.5 rounded font-medium bg-amber-50 text-amber-600">auto</span>
                  )}
                  <p className="text-sm text-gray-700 leading-relaxed w-full">{l.content}</p>
                </div>
                <button
                  onClick={() => retireLearning(l)}
                  className="flex-shrink-0 text-gray-300 hover:text-gray-500 text-lg leading-none mt-0.5"
                  title="Retire this learning"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manual learning input */}
      <div className="mb-8">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5">Add learning manually</p>
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <div className="flex gap-2 mb-2">
            <select
              value={manualLearningCategory}
              onChange={(e) => setManualLearningCategory(e.target.value as 'icp' | 'messaging')}
              className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-300"
            >
              <option value="messaging">Messaging</option>
              <option value="icp">ICP</option>
            </select>
            <select
              value={manualLearningSegment}
              onChange={(e) => setManualLearningSegment(e.target.value)}
              className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-300"
            >
              <option value="">All segments</option>
              {SEGMENT_KEYS.map((s) => (
                <option key={s} value={s}>{SEGMENTS[s].short}</option>
              ))}
            </select>
          </div>
          <textarea
            value={manualLearning}
            onChange={(e) => setManualLearning(e.target.value)}
            placeholder={`e.g. "Leading with the hiring signal gets replies; leading with funding does not"`}
            rows={2}
            className="w-full text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-gray-300 mb-2"
          />
          {manualLearningError && <p className="text-xs text-red-500 mb-2">{manualLearningError}</p>}
          <button
            onClick={saveManualLearning}
            disabled={!manualLearning.trim() || savingManualLearning}
            className="h-9 px-4 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 disabled:opacity-40 transition-colors"
          >
            {savingManualLearning ? 'Saving...' : 'Add learning'}
          </button>
        </div>
      </div>

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
                  <span className="font-medium text-gray-900 text-sm">{WORKLOADS[uc.use_case]?.label ?? uc.use_case}</span>
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
                    className={`h-full rounded-full transition-all ${WORKLOADS[uc.use_case]?.bar ?? 'bg-gray-400'}`}
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
            placeholder={`e.g. "Focus on teams running open models in production" or "Prefer companies with a published API and visible batch workloads"`}
            rows={3}
            className="w-full text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-gray-300 mb-3"
          />
          <button
            onClick={saveManual}
            disabled={!manualFeedback.trim() || savingManual}
            className="h-9 px-4 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 disabled:opacity-40 transition-colors"
          >
            {savingManual ? 'Saving...' : 'Add to search'}
          </button>
        </div>
      </div>

    </main>
  )
}
