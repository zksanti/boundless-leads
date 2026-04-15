'use client'

import { useState, useEffect } from 'react'
import type { LeadWithContacts, CRMStage } from '@/lib/types'

const STAGE_CONFIG: Record<CRMStage, { label: string; color: string; dot: string }> = {
  needs_outreach:  { label: 'Needs outreach',   color: 'bg-gray-100 text-gray-600',       dot: 'bg-gray-400' },
  outreach_sent:   { label: 'Outreach sent',     color: 'bg-blue-50 text-blue-700',        dot: 'bg-blue-400' },
  follow_up_due:   { label: 'Follow-up due',     color: 'bg-orange-50 text-orange-700',    dot: 'bg-orange-400' },
  replied:         { label: 'Replied',            color: 'bg-emerald-50 text-emerald-700',  dot: 'bg-emerald-400' },
  call_scheduled:  { label: 'Call scheduled',    color: 'bg-violet-50 text-violet-700',    dot: 'bg-violet-500' },
  post_call:       { label: 'Post-call',          color: 'bg-indigo-50 text-indigo-700',    dot: 'bg-indigo-400' },
  in_evaluation:   { label: 'In evaluation',     color: 'bg-teal-50 text-teal-700',        dot: 'bg-teal-400' },
  proposal_sent:   { label: 'Proposal sent',     color: 'bg-amber-50 text-amber-700',      dot: 'bg-amber-500' },
  nurture:         { label: 'Nurture',            color: 'bg-slate-100 text-slate-500',     dot: 'bg-slate-400' },
  closed_won:      { label: 'Closed won',         color: 'bg-green-100 text-green-800',     dot: 'bg-green-500' },
  closed_lost:     { label: 'Closed lost',        color: 'bg-red-50 text-red-600',          dot: 'bg-red-400' },
}

const STAGE_ORDER: CRMStage[] = [
  'needs_outreach', 'outreach_sent', 'follow_up_due', 'replied',
  'call_scheduled', 'post_call', 'in_evaluation', 'proposal_sent',
  'nurture', 'closed_won', 'closed_lost',
]

const USE_CASE_COLOR: Record<string, string> = {
  payments:      'bg-blue-50 text-blue-700',
  yield:         'bg-emerald-50 text-emerald-700',
  treasury:      'bg-violet-50 text-violet-700',
  tokenization:  'bg-amber-50 text-amber-700',
}

function StageBadge({ stage }: { stage: CRMStage }) {
  const cfg = STAGE_CONFIG[stage]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

function StageDropdown({
  leadId,
  current,
  onChange,
}: {
  leadId: string
  current: CRMStage
  onChange: (stage: CRMStage) => void
}) {
  const [saving, setSaving] = useState(false)

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const stage = e.target.value as CRMStage
    setSaving(true)
    try {
      await fetch(`/api/leads/${leadId}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      })
      onChange(stage)
    } finally {
      setSaving(false)
    }
  }

  return (
    <select
      value={current}
      onChange={handleChange}
      disabled={saving}
      className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-300 disabled:opacity-50 cursor-pointer"
    >
      {STAGE_ORDER.map((s) => (
        <option key={s} value={s}>{STAGE_CONFIG[s].label}</option>
      ))}
    </select>
  )
}

function ReportModal({ content, onClose }: { content: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-10 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Call Prep Brief</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <div className="px-6 py-5 overflow-y-auto max-h-[70vh]">
          <div className="prose prose-sm prose-gray max-w-none">
            {content.split('\n').map((line, i) => {
              if (line.startsWith('## ')) return <h2 key={i} className="text-base font-semibold text-gray-900 mt-5 mb-2 first:mt-0">{line.slice(3)}</h2>
              if (line.startsWith('### ')) return <h3 key={i} className="text-sm font-semibold text-gray-800 mt-3 mb-1">{line.slice(4)}</h3>
              if (line.startsWith('- ')) return <p key={i} className="text-sm text-gray-700 pl-3 before:content-['•'] before:mr-2 before:text-gray-400">{line.slice(2)}</p>
              if (line.startsWith('---')) return <hr key={i} className="my-4 border-gray-100" />
              if (line.trim() === '') return <div key={i} className="h-1" />
              return <p key={i} className="text-sm text-gray-700 leading-relaxed">{line}</p>
            })}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function buildCalendarUrl(companyName: string) {
  const title = encodeURIComponent(`Boundless / ${companyName}`)
  const details = encodeURIComponent(`Discovery call — ${companyName}\n\nContext: Review call prep brief in Boundless Leads before this call.`)
  return `https://calendar.google.com/calendar/r/eventedit?text=${title}&details=${details}`
}

export default function CRMPage() {
  const [leads, setLeads] = useState<LeadWithContacts[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [reportModal, setReportModal] = useState<{ content: string; leadName: string } | null>(null)
  const [generatingReport, setGeneratingReport] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'active' | 'closed'>('active')

  useEffect(() => {
    fetch('/api/queue')
      .then((r) => r.json())
      .then((data) => {
        setLeads(Array.isArray(data) ? data : [])
        setIsLoading(false)
      })
      .catch(() => setIsLoading(false))
  }, [])

  const updateStage = (leadId: string, stage: CRMStage) => {
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, crm_stage: stage } : l))
  }

  const openReport = async (lead: LeadWithContacts) => {
    // Check for existing report first
    const existing = lead.outreach.find((o) => o.type === 'research_report')
    if (existing) {
      setReportModal({ content: existing.content, leadName: lead.company_name })
      return
    }

    // Generate new report
    setGeneratingReport(lead.id)
    try {
      const res = await fetch(`/api/leads/${lead.id}/report`, { method: 'POST' })
      if (res.ok) {
        const { content } = await res.json()
        // Update local state so we don't re-generate
        setLeads((prev) => prev.map((l) =>
          l.id === lead.id
            ? { ...l, outreach: [...l.outreach, { id: '', lead_id: l.id, contact_id: null, type: 'research_report', content, generated_at: new Date().toISOString() }] }
            : l
        ))
        setReportModal({ content, leadName: lead.company_name })
      }
    } finally {
      setGeneratingReport(null)
    }
  }

  const filtered = leads.filter((l) => {
    if (filter === 'active') return !['closed_won', 'closed_lost', 'nurture'].includes(l.crm_stage)
    if (filter === 'closed') return ['closed_won', 'closed_lost', 'nurture'].includes(l.crm_stage)
    return true
  })

  const sorted = [...filtered].sort((a, b) => STAGE_ORDER.indexOf(a.crm_stage) - STAGE_ORDER.indexOf(b.crm_stage))

  if (isLoading) {
    return (
      <main className="flex items-center justify-center min-h-[60vh]">
        <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </main>
    )
  }

  if (leads.length === 0) {
    return (
      <main className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <p className="text-gray-500">No leads in the pipeline yet.</p>
        <p className="text-sm text-gray-400 mt-1">Swipe right on leads to add them here.</p>
      </main>
    )
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Pipeline</h1>
          <p className="text-xs text-gray-400 mt-0.5">{leads.length} companies</p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          {(['active', 'all', 'closed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize ${
                filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-[2fr_1fr_2fr_2fr_2fr] gap-4 px-5 py-3 border-b border-gray-100 bg-gray-50">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Company</span>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Category</span>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">1-liner</span>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Contacts</span>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Stage</span>
        </div>

        {sorted.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">
            No leads in this view.
          </div>
        ) : (
          sorted.map((lead) => {
            const isExpanded = expandedId === lead.id
            const hasReport = lead.outreach.some((o) => o.type === 'research_report')

            return (
              <div key={lead.id} className="border-b border-gray-100 last:border-0">
                {/* Main row */}
                <div
                  className="grid grid-cols-[2fr_1fr_2fr_2fr_2fr] gap-4 px-5 py-4 hover:bg-gray-50 cursor-pointer transition-colors items-start"
                  onClick={() => setExpandedId(isExpanded ? null : lead.id)}
                >
                  {/* Company */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-gray-900 text-sm truncate">{lead.company_name}</span>
                      {lead.website_url && (
                        <a
                          href={lead.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex-shrink-0 text-gray-300 hover:text-gray-500 transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      )}
                    </div>
                    {(lead.company_size || lead.funding) && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {[lead.company_size, lead.funding].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>

                  {/* Category */}
                  <div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${USE_CASE_COLOR[lead.use_case] ?? 'bg-gray-100 text-gray-600'}`}>
                      {lead.use_case}
                    </span>
                  </div>

                  {/* 1-liner */}
                  <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">{lead.description}</p>

                  {/* Contacts */}
                  <div className="flex flex-col gap-1.5">
                    {lead.contacts.length === 0 ? (
                      <span className="text-xs text-gray-300">—</span>
                    ) : (
                      lead.contacts.map((c) => (
                        <div key={c.id} className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-700 font-medium truncate max-w-[80px]">{c.name}</span>
                          <div className="flex items-center gap-1">
                            {c.linkedin_url && (
                              <a
                                href={c.linkedin_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-gray-300 hover:text-blue-500 transition-colors"
                                title={`${c.name} on LinkedIn`}
                              >
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                                </svg>
                              </a>
                            )}
                            {c.twitter_url && (
                              <a
                                href={c.twitter_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-gray-300 hover:text-gray-900 transition-colors"
                                title={`${c.name} on X`}
                              >
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.741l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                </svg>
                              </a>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Stage */}
                  <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                    <StageDropdown leadId={lead.id} current={lead.crm_stage} onChange={(s) => updateStage(lead.id, s)} />
                    {lead.crm_stage === 'call_scheduled' && (
                      <div className="flex flex-col gap-1">
                        <a
                          href={buildCalendarUrl(lead.company_name)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 font-medium transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Add to Calendar
                        </a>
                        <button
                          onClick={() => openReport(lead)}
                          disabled={generatingReport === lead.id}
                          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 font-medium transition-colors disabled:opacity-50"
                        >
                          {generatingReport === lead.id ? (
                            <>
                              <div className="w-2.5 h-2.5 border border-gray-500 border-t-transparent rounded-full animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              {hasReport ? 'View prep brief' : 'Generate prep brief'}
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded row */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-1 bg-gray-50 border-t border-gray-100 grid grid-cols-2 gap-5">
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Signal</p>
                      <p className="text-sm text-gray-700 leading-relaxed">{lead.signal}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Why Boundless fits</p>
                      <p className="text-sm text-gray-700 leading-relaxed">{lead.why_boundless_fits}</p>
                    </div>
                    {lead.outreach.filter((o) => o.type !== 'research_report').length > 0 && (
                      <div className="col-span-2">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Outreach drafted</p>
                        <p className="text-xs text-gray-500">{lead.outreach.filter((o) => o.type !== 'research_report').map((o) => o.type.replace('_', ' ')).join(', ')}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {reportModal && (
        <ReportModal content={reportModal.content} onClose={() => setReportModal(null)} />
      )}
    </main>
  )
}
