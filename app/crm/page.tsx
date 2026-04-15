'use client'

import { useState, useEffect, useRef } from 'react'
import OutreachModal from '@/components/OutreachModal'
import type { LeadWithContacts, CRMStage, UseCase } from '@/lib/types'

// ─── Config ───────────────────────────────────────────────────────────────────

const STAGE_CONFIG: Record<CRMStage, { label: string; accent: string; badge: string }> = {
  needs_outreach: { label: 'Needs outreach',  accent: 'border-gray-300',   badge: 'bg-gray-100 text-gray-600' },
  outreach_sent:  { label: 'Outreach sent',   accent: 'border-blue-300',   badge: 'bg-blue-50 text-blue-700' },
  follow_up_due:  { label: 'Follow-up due',   accent: 'border-orange-300', badge: 'bg-orange-50 text-orange-700' },
  replied:        { label: 'Replied',          accent: 'border-emerald-300',badge: 'bg-emerald-50 text-emerald-700' },
  call_scheduled: { label: 'Call scheduled',  accent: 'border-violet-400', badge: 'bg-violet-50 text-violet-700' },
  post_call:      { label: 'Post-call',        accent: 'border-indigo-300', badge: 'bg-indigo-50 text-indigo-700' },
  in_evaluation:  { label: 'In evaluation',   accent: 'border-teal-300',   badge: 'bg-teal-50 text-teal-700' },
  proposal_sent:  { label: 'Proposal sent',   accent: 'border-amber-300',  badge: 'bg-amber-50 text-amber-700' },
  nurture:        { label: 'Nurture',          accent: 'border-slate-300',  badge: 'bg-slate-100 text-slate-500' },
  closed_won:     { label: 'Closed won',       accent: 'border-green-400',  badge: 'bg-green-100 text-green-800' },
  closed_lost:    { label: 'Closed lost',      accent: 'border-red-300',    badge: 'bg-red-50 text-red-600' },
}

const BOARD_STAGES: CRMStage[] = [
  'needs_outreach', 'outreach_sent', 'follow_up_due', 'replied',
  'call_scheduled', 'post_call', 'in_evaluation', 'proposal_sent',
]

const ALL_STAGES: CRMStage[] = [
  ...BOARD_STAGES, 'nurture', 'closed_won', 'closed_lost',
]

const USE_CASE_COLOR: Record<string, string> = {
  payments:     'bg-blue-50 text-blue-700',
  yield:        'bg-emerald-50 text-emerald-700',
  treasury:     'bg-violet-50 text-violet-700',
  tokenization: 'bg-amber-50 text-amber-700',
}

function buildCalendarUrl(name: string) {
  const text = encodeURIComponent(`Boundless / ${name}`)
  const details = encodeURIComponent(`Discovery call — ${name}\n\nReview call prep brief in Boundless Leads before this call.`)
  return `https://calendar.google.com/calendar/r/eventedit?text=${text}&details=${details}`
}

// ─── Ticket card (kanban) ──────────────────────────────────────────────────────

function TicketCard({
  lead,
  onClick,
  onDragStart,
  onTogglePriority,
}: {
  lead: LeadWithContacts
  onClick: () => void
  onDragStart: (e: React.DragEvent) => void
  onTogglePriority: (e: React.MouseEvent) => void
}) {
  const hasOutreach = lead.outreach.some((o) => o.type !== 'research_report')
  const hasReport   = lead.outreach.some((o) => o.type === 'research_report')

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className={`bg-white rounded-xl p-3.5 cursor-pointer hover:shadow-sm transition-all active:opacity-70 select-none border ${
        lead.is_priority ? 'border-orange-300 bg-orange-50/30' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      {/* Category + priority + tier */}
      <div className="flex items-center justify-between mb-2.5">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${USE_CASE_COLOR[lead.use_case] ?? 'bg-gray-100 text-gray-600'}`}>
          {lead.use_case}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onTogglePriority}
            title={lead.is_priority ? 'Remove priority' : 'Mark as priority'}
            className={`text-sm leading-none transition-colors ${lead.is_priority ? 'text-orange-500' : 'text-gray-200 hover:text-orange-400'}`}
          >
            ⚑
          </button>
          <span className="text-xs text-gray-300 font-medium">T{lead.tier}</span>
        </div>
      </div>

      {/* Company name */}
      <p className="text-sm font-semibold text-gray-900 mb-1 leading-snug">{lead.company_name}</p>

      {/* 1-liner */}
      <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed mb-3">{lead.description}</p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {lead.contacts.length > 0 && (
            <span className="text-xs text-gray-400">
              {lead.contacts.length} contact{lead.contacts.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {hasOutreach && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" title="Outreach drafted" />}
          {hasReport && <span className="w-1.5 h-1.5 rounded-full bg-violet-400" title="Report generated" />}
        </div>
      </div>
    </div>
  )
}

// ─── Board column ──────────────────────────────────────────────────────────────

function BoardColumn({
  stage,
  leads,
  onCardClick,
  onDrop,
  onTogglePriority,
}: {
  stage: CRMStage
  leads: LeadWithContacts[]
  onCardClick: (lead: LeadWithContacts) => void
  onDrop: (leadId: string, stage: CRMStage) => void
  onTogglePriority: (leadId: string) => void
}) {
  const [isDragOver, setIsDragOver] = useState(false)
  const cfg = STAGE_CONFIG[stage]

  return (
    <div
      className={`flex flex-col rounded-xl border-2 transition-colors h-full ${
        isDragOver ? 'border-gray-400 bg-gray-50' : 'border-transparent'
      }`}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setIsDragOver(false)
        const leadId = e.dataTransfer.getData('leadId')
        if (leadId) onDrop(leadId, stage)
      }}
    >
      {/* Column header */}
      <div className="px-1 pb-2 flex-shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full border-2 ${cfg.accent}`} />
          <span className="text-xs font-semibold text-gray-600">{cfg.label}</span>
        </div>
        {leads.length > 0 && (
          <span className="text-xs text-gray-400 font-medium">{leads.length}</span>
        )}
      </div>

      {/* Cards — scrolls vertically */}
      <div className="flex flex-col gap-2 overflow-y-auto flex-1 pr-0.5">
        {leads.map((lead) => (
          <TicketCard
            key={lead.id}
            lead={lead}
            onClick={() => onCardClick(lead)}
            onDragStart={(e) => {
              e.dataTransfer.setData('leadId', lead.id)
              e.dataTransfer.effectAllowed = 'move'
            }}
            onTogglePriority={(e) => {
              e.stopPropagation()
              onTogglePriority(lead.id)
            }}
          />
        ))}
        {/* Drop zone when empty */}
        {leads.length === 0 && (
          <div className="flex-1 min-h-[80px] rounded-lg border-2 border-dashed border-gray-100" />
        )}
      </div>
    </div>
  )
}

// ─── Report overlay ────────────────────────────────────────────────────────────

function ReportOverlay({ content, onClose }: { content: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 p-6 pt-16 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Call Prep Brief</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <div className="px-6 py-5 overflow-y-auto max-h-[70vh]">
          <div className="space-y-0.5">
            {content.split('\n').map((line, i) => {
              if (line.startsWith('## '))  return <h2  key={i} className="text-base font-bold text-gray-900 mt-6 mb-2 first:mt-0">{line.slice(3)}</h2>
              if (line.startsWith('### ')) return <h3  key={i} className="text-sm font-semibold text-gray-800 mt-4 mb-1">{line.slice(4)}</h3>
              if (line.startsWith('- '))   return <p   key={i} className="text-sm text-gray-700 pl-4 relative before:content-['·'] before:absolute before:left-1 before:text-gray-400">{line.slice(2)}</p>
              if (line.startsWith('---'))  return <hr  key={i} className="my-4 border-gray-100" />
              if (line.trim() === '')      return <div key={i} className="h-2" />
              return <p key={i} className="text-sm text-gray-700 leading-relaxed">{line}</p>
            })}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-900 text-white rounded-xl hover:bg-gray-800">Close</button>
        </div>
      </div>
    </div>
  )
}

// ─── Lead drawer ───────────────────────────────────────────────────────────────

function LeadDrawer({
  lead,
  onClose,
  onStageChange,
  onOpenOutreach,
  onReportGenerated,
}: {
  lead: LeadWithContacts
  onClose: () => void
  onStageChange: (leadId: string, stage: CRMStage) => void
  onOpenOutreach: () => void
  onReportGenerated: (leadId: string, content: string) => void
}) {
  const [stageSaving, setStageSaving] = useState(false)
  const [currentStage, setCurrentStage] = useState<CRMStage>(lead.crm_stage)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [reportContent, setReportContent] = useState<string | null>(
    lead.outreach.find((o) => o.type === 'research_report')?.content ?? null
  )
  const [showReport, setShowReport] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)

  // Reset when lead changes
  useEffect(() => {
    setCurrentStage(lead.crm_stage)
    setReportContent(lead.outreach.find((o) => o.type === 'research_report')?.content ?? null)
    setShowReport(false)
  }, [lead.id, lead.crm_stage, lead.outreach])

  const handleStageChange = async (stage: CRMStage) => {
    setStageSaving(true)
    setCurrentStage(stage)
    try {
      await fetch(`/api/leads/${lead.id}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      })
      onStageChange(lead.id, stage)
    } finally {
      setStageSaving(false)
    }
  }

  const generateReport = async () => {
    setGeneratingReport(true)
    try {
      const res = await fetch(`/api/leads/${lead.id}/report`, { method: 'POST' })
      if (res.ok) {
        const { content } = await res.json()
        setReportContent(content)
        onReportGenerated(lead.id, content)
        setShowReport(true)
      }
    } finally {
      setGeneratingReport(false)
    }
  }

  const cfg = STAGE_CONFIG[currentStage]

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className="fixed top-0 right-0 bottom-0 z-50 w-[420px] bg-white shadow-2xl flex flex-col overflow-hidden border-l border-gray-200"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-bold text-gray-900 text-base truncate">{lead.company_name}</h2>
              {lead.website_url && (
                <a
                  href={lead.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 text-gray-300 hover:text-gray-500 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>
            <div className="flex items-center flex-wrap gap-1.5">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${USE_CASE_COLOR[lead.use_case] ?? 'bg-gray-100 text-gray-600'}`}>
                {lead.use_case}
              </span>
              <span className="text-xs text-gray-400">Tier {lead.tier}</span>
              {lead.company_size && <span className="text-xs text-gray-400">· {lead.company_size}</span>}
              {lead.funding && <span className="text-xs text-gray-400">· {lead.funding}</span>}
            </div>
          </div>
          <button onClick={onClose} className="flex-shrink-0 text-gray-400 hover:text-gray-600 text-lg leading-none mt-0.5">✕</button>
        </div>

        {/* Stage selector */}
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Stage</span>
          <div className="flex-1">
            <select
              value={currentStage}
              onChange={(e) => handleStageChange(e.target.value as CRMStage)}
              disabled={stageSaving}
              className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border focus:outline-none focus:ring-1 focus:ring-gray-300 disabled:opacity-60 cursor-pointer w-full ${cfg.badge} border-transparent`}
            >
              {ALL_STAGES.map((s) => (
                <option key={s} value={s}>{STAGE_CONFIG[s].label}</option>
              ))}
            </select>
          </div>
          {stageSaving && <div className="w-3.5 h-3.5 border border-gray-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* Description */}
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Description</p>
            <p className="text-sm text-gray-700 leading-relaxed">{lead.description}</p>
          </div>

          {/* Signal */}
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Signal</p>
            <p className="text-sm text-gray-700 leading-relaxed">{lead.signal}</p>
          </div>

          {/* Why it fits */}
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Why Boundless fits</p>
            <p className="text-sm text-gray-700 leading-relaxed">{lead.why_boundless_fits}</p>
          </div>

          {/* Contacts */}
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5">Contacts</p>
            {lead.contacts.length === 0 ? (
              <p className="text-sm text-gray-400">No contacts on file</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {lead.contacts.map((c) => (
                  <div key={c.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.title}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.linkedin_url && (
                        <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer"
                          className="text-gray-300 hover:text-blue-500 transition-colors" title="LinkedIn">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                          </svg>
                        </a>
                      )}
                      {c.twitter_url && (
                        <a href={c.twitter_url} target="_blank" rel="noopener noreferrer"
                          className="text-gray-300 hover:text-gray-800 transition-colors" title="X / Twitter">
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.741l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-5 py-4 flex flex-col gap-2.5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Actions</p>

            {/* Outreach */}
            <button
              onClick={onOpenOutreach}
              className="w-full h-10 flex items-center justify-center gap-2 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {lead.outreach.some((o) => o.type !== 'research_report') ? 'View / edit outreach' : 'Generate outreach'}
            </button>

            {/* Report */}
            <button
              onClick={reportContent ? () => setShowReport(true) : generateReport}
              disabled={generatingReport}
              className="w-full h-10 flex items-center justify-center gap-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {generatingReport ? (
                <>
                  <div className="w-4 h-4 border border-gray-500 border-t-transparent rounded-full animate-spin" />
                  Generating prep brief...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {reportContent ? 'View call prep brief' : 'Generate call prep brief'}
                </>
              )}
            </button>

            {/* Calendar — always available */}
            <a
              href={buildCalendarUrl(lead.company_name)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-10 flex items-center justify-center gap-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Schedule call in Google Calendar
            </a>
          </div>
        </div>
      </div>

      {showReport && reportContent && (
        <ReportOverlay content={reportContent} onClose={() => setShowReport(false)} />
      )}
    </>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function CRMPage() {
  const [leads, setLeads] = useState<LeadWithContacts[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedLead, setSelectedLead] = useState<LeadWithContacts | null>(null)
  const [outreachLead, setOutreachLead] = useState<LeadWithContacts | null>(null)
  const [showClosed, setShowClosed] = useState(false)
  const [serviceFilter, setServiceFilter] = useState<UseCase | 'all'>('all')

  useEffect(() => {
    fetch('/api/queue')
      .then((r) => r.json())
      .then((data) => { setLeads(Array.isArray(data) ? data : []); setIsLoading(false) })
      .catch(() => setIsLoading(false))
  }, [])

  const handleTogglePriority = async (leadId: string) => {
    const res = await fetch(`/api/leads/${leadId}/priority`, { method: 'PATCH' })
    if (res.ok) {
      const { is_priority } = await res.json()
      setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, is_priority } : l))
      if (selectedLead?.id === leadId) setSelectedLead((prev) => prev ? { ...prev, is_priority } : null)
    }
  }

  const handleDrop = async (leadId: string, newStage: CRMStage) => {
    const lead = leads.find((l) => l.id === leadId)
    if (!lead || lead.crm_stage === newStage) return
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, crm_stage: newStage } : l))
    if (selectedLead?.id === leadId) setSelectedLead((prev) => prev ? { ...prev, crm_stage: newStage } : null)
    await fetch(`/api/leads/${leadId}/stage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: newStage }),
    })
  }

  const handleStageChange = (leadId: string, stage: CRMStage) => {
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, crm_stage: stage } : l))
  }

  const handleReportGenerated = (leadId: string, content: string) => {
    setLeads((prev) => prev.map((l) =>
      l.id === leadId
        ? { ...l, outreach: [...l.outreach, { id: '', lead_id: l.id, contact_id: null, type: 'research_report', content, generated_at: new Date().toISOString() }] }
        : l
    ))
    if (selectedLead?.id === leadId) {
      setSelectedLead((prev) => prev
        ? { ...prev, outreach: [...prev.outreach, { id: '', lead_id: leadId, contact_id: null, type: 'research_report', content, generated_at: new Date().toISOString() }] }
        : null
      )
    }
  }

  const visibleStages = showClosed ? ALL_STAGES : BOARD_STAGES
  const filteredLeads = serviceFilter === 'all' ? leads : leads.filter((l) => l.use_case === serviceFilter)
  const leadsByStage: Record<CRMStage, LeadWithContacts[]> = {} as Record<CRMStage, LeadWithContacts[]>
  for (const s of ALL_STAGES) leadsByStage[s] = []
  for (const l of filteredLeads) {
    // Priority leads float to top of their column
    if (l.is_priority) leadsByStage[l.crm_stage]?.unshift(l)
    else leadsByStage[l.crm_stage]?.push(l)
  }

  const closedCount = filteredLeads.filter((l) => ['nurture', 'closed_won', 'closed_lost'].includes(l.crm_stage)).length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <p className="text-gray-500">No leads in pipeline yet.</p>
        <p className="text-sm text-gray-400 mt-1">Swipe right on leads to add them here.</p>
      </div>
    )
  }

  const BOARD_H = 'calc(100vh - 56px)'
  const COLUMN_H = 'calc(100vh - 130px)'

  return (
    <>
      <div className="flex flex-col bg-gray-50" style={{ height: BOARD_H }}>

        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-white gap-4">
          <div className="flex-shrink-0">
            <h1 className="text-sm font-semibold text-gray-900">Pipeline</h1>
            <p className="text-xs text-gray-400">{leads.length} companies</p>
          </div>

          {/* Service filter */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 flex-shrink-0">
            {(['all', 'payments', 'yield', 'treasury', 'tokenization'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setServiceFilter(f)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors capitalize ${
                  serviceFilter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {closedCount > 0 && (
            <button
              onClick={() => setShowClosed((v) => !v)}
              className="flex-shrink-0 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showClosed ? 'Hide closed' : `Closed (${closedCount})`}
            </button>
          )}
        </div>

        {/* Board — horizontal scroll */}
        <div
          className="flex-1 overflow-x-auto"
          style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        >
          <div className="flex gap-3 px-4 pt-4 pb-4" style={{ minWidth: 'max-content' }}>
            {visibleStages.map((stage) => (
              <div key={stage} style={{ width: 220, height: COLUMN_H, display: 'flex', flexDirection: 'column' }}>
                <BoardColumn
                  stage={stage}
                  leads={leadsByStage[stage]}
                  onCardClick={(lead) => setSelectedLead(lead)}
                  onDrop={handleDrop}
                  onTogglePriority={handleTogglePriority}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Drawer */}
      {selectedLead && (
        <LeadDrawer
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onStageChange={handleStageChange}
          onOpenOutreach={() => setOutreachLead(selectedLead)}
          onReportGenerated={handleReportGenerated}
        />
      )}

      {/* Outreach modal */}
      {outreachLead && (
        <OutreachModal lead={outreachLead} onClose={() => setOutreachLead(null)} />
      )}
    </>
  )
}
