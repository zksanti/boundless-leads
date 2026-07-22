'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import OutreachModal from '@/components/OutreachModal'
import type { LeadWithContacts, CRMStage, UseCase, OutreachChannel, Segment, Conversation, ValidationRecord } from '@/lib/types'
import { WORKLOADS, WORKLOAD_KEYS } from '@/lib/workloads'
import { SEGMENTS, SEGMENT_KEYS } from '@/lib/segments'
import { CONVERSATION_KINDS, kindLabel, tagLabel } from '@/lib/taxonomy'
import { ThinkingOrb } from 'thinking-orbs'

const CHANNEL_CONFIG: Record<OutreachChannel, { label: string; badge: string }> = {
  linkedin: { label: 'LinkedIn', badge: 'bg-blue-50 text-blue-700' },
  x:        { label: 'X',        badge: 'bg-gray-100 text-gray-700' },
  telegram: { label: 'Telegram', badge: 'bg-sky-50 text-sky-700' },
}

const FOLLOWUP_MS = 72 * 60 * 60 * 1000 // 72 hours in ms

function useFollowUpTimer(sentAt: string | null) {
  const [remainingMs, setRemainingMs] = useState<number>(() =>
    sentAt ? FOLLOWUP_MS - (Date.now() - new Date(sentAt).getTime()) : FOLLOWUP_MS
  )
  useEffect(() => {
    if (!sentAt) return
    const tick = () => setRemainingMs(FOLLOWUP_MS - (Date.now() - new Date(sentAt).getTime()))
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [sentAt])
  return remainingMs
}

function TimerBadge({ sentAt }: { sentAt: string | null }) {
  const ms = useFollowUpTimer(sentAt)
  if (!sentAt) return null
  if (ms <= 0) return <span className="text-xs font-medium text-red-500">Follow up now</span>
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const color = ms < 24 * 3_600_000 ? 'text-orange-500' : 'text-gray-400'
  return <span className={`text-xs font-medium tabular-nums ${color}`}>{h}h {m}m left</span>
}

import type { Contact } from '@/lib/types'

function EditableContact({ contact, onSaved }: { contact: Contact; onSaved: (c: Contact) => void }) {
  const [editing, setEditing] = useState(false)
  const [fields, setFields] = useState({ name: contact.name, title: contact.title, email: contact.email, linkedin_url: contact.linkedin_url, twitter_url: contact.twitter_url })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      if (res.ok) {
        const { contact: updated } = await res.json()
        onSaved(updated)
        setEditing(false)
      }
    } finally {
      setSaving(false)
    }
  }

  const cancel = () => {
    setFields({ name: contact.name, title: contact.title, email: contact.email, linkedin_url: contact.linkedin_url, twitter_url: contact.twitter_url })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="bg-gray-50 rounded-xl p-3 flex flex-col gap-2">
        <input value={fields.name} onChange={(e) => setFields(f => ({ ...f, name: e.target.value }))}
          placeholder="Name" className="text-sm bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-300 w-full" />
        <input value={fields.title} onChange={(e) => setFields(f => ({ ...f, title: e.target.value }))}
          placeholder="Title" className="text-sm bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-300 w-full" />
        <input value={fields.email} onChange={(e) => setFields(f => ({ ...f, email: e.target.value }))}
          placeholder="Email" className="text-sm bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-300 w-full" />
        <input value={fields.linkedin_url} onChange={(e) => setFields(f => ({ ...f, linkedin_url: e.target.value }))}
          placeholder="LinkedIn URL" className="text-sm bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-300 w-full" />
        <input value={fields.twitter_url} onChange={(e) => setFields(f => ({ ...f, twitter_url: e.target.value }))}
          placeholder="X / Twitter URL" className="text-sm bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-300 w-full" />
        <div className="flex gap-2 pt-0.5">
          <button onClick={save} disabled={saving}
            className="h-7 px-3 text-xs font-medium bg-gray-900 text-white rounded-full hover:bg-gray-800 disabled:opacity-50 transition-colors">
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button onClick={cancel} className="h-7 px-3 text-xs text-gray-500 hover:text-gray-700 transition-colors">Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">{contact.name}</p>
        <p className="text-xs text-gray-400">{contact.title}</p>
        {contact.email && (
          <a href={`mailto:${contact.email}`} className="text-xs text-blue-600 hover:underline truncate block">{contact.email}</a>
        )}
      </div>
      <div className="flex items-center gap-2">
        {contact.linkedin_url && (
          <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer"
            className="text-gray-300 hover:text-blue-500 transition-colors" title="Search on LinkedIn">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
          </a>
        )}
        {contact.twitter_url && (
          <a href={contact.twitter_url} target="_blank" rel="noopener noreferrer"
            className="text-gray-300 hover:text-gray-800 transition-colors" title="X / Twitter">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.741l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
        )}
        <button onClick={() => setEditing(true)}
          className="text-gray-300 hover:text-gray-600 transition-colors"
          title="Edit contact">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      </div>
    </div>
  )
}

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

// Experiment progress per segment (Customer Discovery Experiment doc):
// a promising segment produces >=3 substantive replies, >=2 discovery
// conversations, and >=1 accepted benchmark from 15-20 researched accounts.
const REPLY_STAGES: CRMStage[]     = ['replied', 'call_scheduled', 'post_call', 'in_evaluation', 'proposal_sent', 'closed_won']
const CALL_STAGES: CRMStage[]      = ['call_scheduled', 'post_call', 'in_evaluation', 'proposal_sent', 'closed_won']
const BENCHMARK_STAGES: CRMStage[] = ['in_evaluation', 'proposal_sent', 'closed_won']

function SegmentProgress({ leads }: { leads: LeadWithContacts[] }) {
  const replies    = leads.filter((l) => REPLY_STAGES.includes(l.crm_stage)).length
  const calls      = leads.filter((l) => CALL_STAGES.includes(l.crm_stage)).length
  const benchmarks = leads.filter((l) => BENCHMARK_STAGES.includes(l.crm_stage)).length

  const stat = (label: string, value: number, target: number) => (
    <span className={`text-xs font-medium tabular-nums ${value >= target ? 'text-emerald-600' : 'text-gray-400'}`}>
      {label} {value}/{target}
    </span>
  )

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-400 tabular-nums">{leads.length} accounts</span>
      <span className="text-gray-200">|</span>
      {stat('Replies', replies, 3)}
      {stat('Calls', calls, 2)}
      {stat('Benchmarks', benchmarks, 1)}
    </div>
  )
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
  const hasOutreach = lead.outreach.some((o) => o.type !== 'research_report' && o.type !== 'sent_message')
  const hasReport   = lead.outreach.some((o) => o.type === 'research_report')
  const hasSent     = lead.outreach.some((o) => o.type === 'sent_message')
  const isOutreachSent = lead.crm_stage === 'outreach_sent'
  const remainingMs = FOLLOWUP_MS - (lead.outreach_sent_at ? Date.now() - new Date(lead.outreach_sent_at).getTime() : 0)
  const isExpired = isOutreachSent && lead.outreach_sent_at && remainingMs <= 0
  const channel = lead.outreach_channel ? CHANNEL_CONFIG[lead.outreach_channel] : null

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className={`rounded-xl p-3.5 cursor-pointer hover:shadow-sm transition-all active:opacity-70 select-none border ${
        isExpired
          ? 'border-red-200 bg-red-50/40'
          : lead.is_priority
          ? 'border-orange-300 bg-orange-50/30'
          : 'bg-white border-gray-200 hover:border-gray-300'
      }`}
    >
      {/* Segment + category + priority + channel/tier */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1 min-w-0">
          {lead.segment && SEGMENTS[lead.segment as Segment] && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold border flex-shrink-0 ${SEGMENTS[lead.segment as Segment].chip}`}>
              {SEGMENTS[lead.segment as Segment].short}
            </span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium truncate ${WORKLOADS[lead.use_case]?.chip ?? 'bg-gray-100 text-gray-600'}`}>
            {WORKLOADS[lead.use_case]?.label ?? lead.use_case}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onTogglePriority}
            title={lead.is_priority ? 'Remove priority' : 'Mark as priority'}
            className={`text-sm leading-none transition-colors ${lead.is_priority ? 'text-orange-500' : 'text-gray-200 hover:text-orange-400'}`}
          >
            ⚑
          </button>
          {channel
            ? <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${channel.badge}`}>{channel.label}</span>
            : <span className="text-xs text-gray-300 font-medium">T{lead.tier}</span>
          }
        </div>
      </div>

      {/* Company name */}
      <p className="text-sm font-semibold text-gray-900 mb-1 leading-snug">{lead.company_name}</p>

      {/* 1-liner */}
      <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed mb-3">{lead.description}</p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isOutreachSent && lead.outreach_sent_at && (
            <TimerBadge sentAt={lead.outreach_sent_at} />
          )}
          {!isOutreachSent && lead.contacts.length > 0 && (
            <span className="text-xs text-gray-400">
              {lead.contacts.length} contact{lead.contacts.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {hasOutreach && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" title="Outreach drafted" />}
          {hasSent    && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Message logged" />}
          {hasReport  && <span className="w-1.5 h-1.5 rounded-full bg-violet-400" title="Report generated" />}
        </div>
      </div>
    </div>
  )
}

function AddContactForm({ leadId, onSaved, onCancel }: { leadId: string; onSaved: (c: Contact) => void; onCancel: () => void }) {
  const [fields, setFields] = useState({ name: '', title: '', email: '', linkedin_url: '', twitter_url: '' })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!fields.name.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/leads/${leadId}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      if (res.ok) {
        const { contact } = await res.json()
        onSaved(contact)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-gray-50 rounded-xl p-3 flex flex-col gap-2">
      <input value={fields.name} onChange={(e) => setFields(f => ({ ...f, name: e.target.value }))}
        placeholder="Name *" className="text-sm bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-300 w-full" />
      <input value={fields.title} onChange={(e) => setFields(f => ({ ...f, title: e.target.value }))}
        placeholder="Title" className="text-sm bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-300 w-full" />
      <input value={fields.email} onChange={(e) => setFields(f => ({ ...f, email: e.target.value }))}
        placeholder="Email" className="text-sm bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-300 w-full" />
      <input value={fields.linkedin_url} onChange={(e) => setFields(f => ({ ...f, linkedin_url: e.target.value }))}
        placeholder="LinkedIn URL" className="text-sm bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-300 w-full" />
      <input value={fields.twitter_url} onChange={(e) => setFields(f => ({ ...f, twitter_url: e.target.value }))}
        placeholder="X / Twitter URL" className="text-sm bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-300 w-full" />
      <div className="flex gap-2 pt-0.5">
        <button onClick={save} disabled={saving || !fields.name.trim()}
          className="h-7 px-3 text-xs font-medium bg-gray-900 text-white rounded-full hover:bg-gray-800 disabled:opacity-50 transition-colors">
          {saving ? 'Saving...' : 'Add contact'}
        </button>
        <button onClick={onCancel} className="h-7 px-3 text-xs text-gray-500 hover:text-gray-700 transition-colors">Cancel</button>
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

// ─── Add company modal ─────────────────────────────────────────────────────────

function AddCompanyModal({
  segment,
  onAdded,
  onClose,
}: {
  segment: Segment
  onAdded: (lead: LeadWithContacts) => void
  onClose: () => void
}) {
  const [fields, setFields] = useState({
    company_name: '', website_url: '', company_linkedin_url: '',
    description: '', signal: '', why_boundless_fits: '',
    company_size: '', funding: '',
    use_case: 'batch' as UseCase, segment, tier: 1,
    contact_name: '', contact_title: '', contact_email: '', contact_linkedin: '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string | number) => setFields((f) => ({ ...f, [k]: v }))

  const save = async () => {
    if (!fields.company_name.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: fields.company_name,
          website_url: fields.website_url,
          company_linkedin_url: fields.company_linkedin_url,
          description: fields.description,
          signal: fields.signal,
          why_boundless_fits: fields.why_boundless_fits,
          company_size: fields.company_size,
          funding: fields.funding,
          use_case: fields.use_case,
          segment: fields.segment,
          tier: fields.tier,
          contact: fields.contact_name.trim()
            ? { name: fields.contact_name, title: fields.contact_title, email: fields.contact_email, linkedin_url: fields.contact_linkedin }
            : null,
        }),
      })
      if (res.ok) {
        const { lead } = await res.json()
        onAdded(lead)
        onClose()
      }
    } finally {
      setSaving(false)
    }
  }

  const input = 'text-sm bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-300 w-full'
  const label = 'text-xs font-semibold text-gray-400 uppercase tracking-wide'

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 p-6 pt-12 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Add company</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <div className="px-6 py-4 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
          {/* Segment + workload + tier */}
          <div className="flex flex-col gap-2">
            <span className={label}>Segment</span>
            <div className="flex gap-1.5 flex-wrap">
              {SEGMENT_KEYS.map((s) => (
                <button key={s} onClick={() => set('segment', s)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium border transition-colors ${
                    fields.segment === s ? SEGMENTS[s].chip + ' ring-1 ring-inset ring-current' : 'bg-gray-100 text-gray-400 border-transparent hover:text-gray-600'
                  }`}>
                  {SEGMENTS[s].short}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-1.5">
              <span className={label}>Workload</span>
              <select value={fields.use_case} onChange={(e) => set('use_case', e.target.value)} className={input + ' cursor-pointer'}>
                {WORKLOAD_KEYS.map((w) => <option key={w} value={w}>{WORKLOADS[w].label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className={label}>Tier</span>
              <div className="flex gap-1.5">
                {[1, 2].map((t) => (
                  <button key={t} onClick={() => set('tier', t)}
                    className={`text-xs px-3 py-2 rounded-lg font-medium transition-colors ${
                      fields.tier === t ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400 hover:text-gray-600'
                    }`}>
                    T{t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Company */}
          <div className="flex flex-col gap-2">
            <span className={label}>Company</span>
            <input value={fields.company_name} onChange={(e) => set('company_name', e.target.value)} placeholder="Company name *" className={input} />
            <input value={fields.website_url} onChange={(e) => set('website_url', e.target.value)} placeholder="Website URL" className={input} />
            <input value={fields.company_linkedin_url} onChange={(e) => set('company_linkedin_url', e.target.value)} placeholder="Company LinkedIn URL" className={input} />
            <div className="flex gap-2">
              <input value={fields.company_size} onChange={(e) => set('company_size', e.target.value)} placeholder="Size (e.g. 5-15)" className={input} />
              <input value={fields.funding} onChange={(e) => set('funding', e.target.value)} placeholder="Funding (e.g. Seed, $4M)" className={input} />
            </div>
            <textarea value={fields.description} onChange={(e) => set('description', e.target.value)} placeholder="One sentence on what they build" rows={2} className={input + ' resize-none'} />
          </div>

          {/* Qualification */}
          <div className="flex flex-col gap-2">
            <span className={label}>Qualification</span>
            <textarea value={fields.signal} onChange={(e) => set('signal', e.target.value)} placeholder="Signal — the specific thing that makes them a fit right now" rows={2} className={input + ' resize-none'} />
            <textarea value={fields.why_boundless_fits} onChange={(e) => set('why_boundless_fits', e.target.value)} placeholder="Why Boundless fits — workload, why it's cost/capacity-bound, where we plug in" rows={3} className={input + ' resize-none'} />
          </div>

          {/* Primary contact (optional) */}
          <div className="flex flex-col gap-2">
            <span className={label}>Primary contact (optional)</span>
            <div className="flex gap-2">
              <input value={fields.contact_name} onChange={(e) => set('contact_name', e.target.value)} placeholder="Name" className={input} />
              <input value={fields.contact_title} onChange={(e) => set('contact_title', e.target.value)} placeholder="Title" className={input} />
            </div>
            <div className="flex gap-2">
              <input value={fields.contact_email} onChange={(e) => set('contact_email', e.target.value)} placeholder="Email" className={input} />
              <input value={fields.contact_linkedin} onChange={(e) => set('contact_linkedin', e.target.value)} placeholder="LinkedIn URL" className={input} />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="h-9 px-4 text-sm text-gray-500 hover:text-gray-700 transition-colors">Cancel</button>
          <button onClick={save} disabled={saving || !fields.company_name.trim()}
            className="h-9 px-4 text-sm font-medium bg-gray-900 text-white rounded-full hover:bg-gray-800 disabled:opacity-40 transition-colors">
            {saving ? 'Adding...' : 'Add to pipeline'}
          </button>
        </div>
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
          <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-900 text-white rounded-full hover:bg-gray-800">Close</button>
        </div>
      </div>
    </div>
  )
}

// ─── Validation record ─────────────────────────────────────────────────────────

const FIT_CHIP: Record<string, string> = {
  high:   'bg-emerald-50 text-emerald-700',
  medium: 'bg-amber-50 text-amber-700',
  low:    'bg-red-50 text-red-600',
}

const WORKLOAD_STATUS_CHIP: Record<string, string> = {
  confirmed: 'bg-emerald-50 text-emerald-700',
  denied:    'bg-red-50 text-red-600',
  unknown:   'bg-gray-100 text-gray-500',
}

function ValidationSection({ validation }: { validation: ValidationRecord }) {
  const rows: Array<[string, React.ReactNode]> = []
  if (validation.workload) {
    rows.push(['Workload', (
      <span key="w" className="inline-flex items-center gap-1.5">
        {validation.workload}
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${WORKLOAD_STATUS_CHIP[validation.workload_status]}`}>
          {validation.workload_status}
        </span>
      </span>
    )])
  }
  if (validation.current_provider) rows.push(['Provider', validation.current_provider])
  if (validation.pain) rows.push(['Pain', validation.pain])
  if (validation.blockers.length > 0) rows.push(['Blockers', validation.blockers.join('; ')])
  if (validation.next_step) rows.push(['Next step', validation.next_step])

  return (
    <div className="px-5 py-4 border-b border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Validation</p>
        {validation.fit_confidence && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${FIT_CHIP[validation.fit_confidence]}`}>
            {validation.fit_confidence} confidence
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex gap-2 text-sm">
            <span className="text-gray-400 flex-shrink-0 w-20">{label}</span>
            <span className="text-gray-700 leading-snug">{value}</span>
          </div>
        ))}
        {validation.open_questions.length > 0 && (
          <div className="mt-1">
            <p className="text-xs text-gray-400 mb-1">Open questions</p>
            {validation.open_questions.map((q, i) => (
              <p key={i} className="text-sm text-gray-700 pl-4 relative before:content-['·'] before:absolute before:left-1 before:text-gray-400">{q}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Conversations ─────────────────────────────────────────────────────────────

const KIND_BADGE: Record<string, string> = {
  call_transcript: 'bg-violet-50 text-violet-700',
  email_reply:     'bg-blue-50 text-blue-700',
  linkedin_reply:  'bg-sky-50 text-sky-700',
  x_reply:         'bg-gray-100 text-gray-700',
  notes:           'bg-amber-50 text-amber-700',
}

function ConversationEntry({ conv, onDelete }: { conv: Conversation; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${KIND_BADGE[conv.kind] ?? 'bg-gray-100 text-gray-600'}`}>
            {kindLabel(conv.kind)}
          </span>
          <span className="text-xs text-gray-400">{conv.occurred_at?.slice(0, 10)}</span>
          {conv.primary_tag && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">{tagLabel(conv.primary_tag)}</span>
          )}
          {conv.secondary_tag && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50/60 text-indigo-500">{tagLabel(conv.secondary_tag)}</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => setExpanded((e) => !e)} className="text-xs text-gray-400 hover:text-gray-600">
            {expanded ? 'Hide' : 'View'}
          </button>
          <button onClick={() => onDelete(conv.id)} className="text-gray-300 hover:text-red-500 text-xs" title="Delete">✕</button>
        </div>
      </div>
      {conv.analysis?.summary && (
        <p className="text-xs text-gray-500 mt-1.5 leading-snug">{conv.analysis.summary}</p>
      )}
      {expanded && (
        <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap leading-relaxed border-t border-gray-200 pt-2">{conv.content}</p>
      )}
    </div>
  )
}

function ConversationsSection({
  lead,
  onValidationUpdated,
  onApplyStage,
  currentStage,
}: {
  lead: LeadWithContacts
  onValidationUpdated: (v: ValidationRecord) => void
  onApplyStage: (stage: CRMStage) => void
  currentStage: CRMStage
}) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [showForm, setShowForm] = useState(false)
  const [kind, setKind] = useState<string>('call_transcript')
  const [content, setContent] = useState('')
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [analyzing, setAnalyzing] = useState(false)
  const [lastResult, setLastResult] = useState<{
    learningCount: number
    autoApplied: boolean
    suggestedStage: CRMStage | null
    stageRationale: string
  } | null>(null)

  useEffect(() => {
    setLastResult(null)
    setShowForm(false)
    fetch(`/api/leads/${lead.id}/conversations`)
      .then((r) => r.json())
      .then((data) => setConversations(data.conversations ?? []))
      .catch(() => setConversations([]))
  }, [lead.id])

  const handleSave = async () => {
    if (!content.trim() || analyzing) return
    setAnalyzing(true)
    setLastResult(null)
    try {
      const res = await fetch(`/api/leads/${lead.id}/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), kind, occurred_at: occurredAt }),
      })
      if (!res.ok) return
      const data = await res.json()
      setConversations((prev) => [data.conversation, ...prev])
      if (data.validation) onValidationUpdated(data.validation)
      setLastResult({
        learningCount: data.learnings?.length ?? 0,
        autoApplied: data.learnings?.[0]?.auto_applied ?? false,
        suggestedStage: data.suggestedStage ?? null,
        stageRationale: data.stageRationale ?? '',
      })
      setContent('')
      setShowForm(false)
    } finally {
      setAnalyzing(false)
    }
  }

  const handleDelete = async (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id))
    await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
  }

  return (
    <div className="px-5 py-4 border-b border-gray-100">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Conversations</p>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
            + Log conversation
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-gray-50 rounded-xl p-3 mb-3 flex flex-col gap-2">
          <div className="flex gap-2">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="text-xs bg-white border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-300"
            >
              {CONVERSATION_KINDS.map((k) => (
                <option key={k.kind} value={k.kind}>{k.label}</option>
              ))}
            </select>
            <input
              type="date"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              className="text-xs bg-white border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-300"
            />
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste the transcript, reply, or notes..."
            rows={6}
            className="w-full text-sm text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-1 focus:ring-gray-300"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={analyzing || !content.trim()}
              className="h-8 px-3 text-xs font-medium rounded-full bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40 transition-colors flex items-center gap-2"
            >
              {analyzing && <ThinkingOrb state="solving" size={20} theme="dark" />}
              {analyzing ? 'Analyzing conversation...' : 'Save & analyze'}
            </button>
            <button onClick={() => setShowForm(false)} className="h-8 px-3 text-xs text-gray-500 hover:text-gray-700 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {lastResult && (
        <div className="mb-3 flex flex-col gap-1.5">
          {lastResult.learningCount > 0 && (
            <p className="text-xs text-gray-500">
              {lastResult.learningCount} learning{lastResult.learningCount > 1 ? 's' : ''}{' '}
              {lastResult.autoApplied ? 'auto-applied' : 'queued for review'}
            </p>
          )}
          {lastResult.suggestedStage && lastResult.suggestedStage !== currentStage && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500" title={lastResult.stageRationale}>
                Suggests: <span className="font-medium text-gray-700">{STAGE_CONFIG[lastResult.suggestedStage].label}</span>
              </span>
              <button
                onClick={() => { onApplyStage(lastResult.suggestedStage!); setLastResult((r) => r ? { ...r, suggestedStage: null } : null) }}
                className="text-xs px-2 py-0.5 rounded-full bg-gray-900 text-white hover:bg-gray-800 transition-colors"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {conversations.map((c) => (
          <ConversationEntry key={c.id} conv={c} onDelete={handleDelete} />
        ))}
        {conversations.length === 0 && !showForm && (
          <p className="text-sm text-gray-400">No conversations logged</p>
        )}
      </div>
    </div>
  )
}

// ─── Lead drawer ───────────────────────────────────────────────────────────────

function LeadDrawer({
  lead,
  onClose,
  onStageChange,
  onChannelChange,
  onSegmentChange,
  onOpenOutreach,
  onReportGenerated,
  onSentMessageSaved,
  onContactUpdated,
  onContactAdded,
}: {
  lead: LeadWithContacts
  onClose: () => void
  onStageChange: (leadId: string, stage: CRMStage) => void
  onChannelChange: (leadId: string, channel: OutreachChannel) => void
  onSegmentChange: (leadId: string, segment: Segment | '') => void
  onOpenOutreach: () => void
  onReportGenerated: (leadId: string, content: string) => void
  onSentMessageSaved: (leadId: string, content: string) => void
  onContactUpdated: (leadId: string, contact: Contact) => void
  onContactAdded: (leadId: string, contact: Contact) => void
}) {
  const [stageSaving, setStageSaving] = useState(false)
  const [currentStage, setCurrentStage] = useState<CRMStage>(lead.crm_stage)
  const [currentChannel, setCurrentChannel] = useState<OutreachChannel | null>(lead.outreach_channel)
  const [currentSegment, setCurrentSegment] = useState<Segment | ''>(lead.segment)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [reportContent, setReportContent] = useState<string | null>(
    lead.outreach.find((o) => o.type === 'research_report')?.content ?? null
  )
  const [showReport, setShowReport] = useState(false)
  const [sentMessage, setSentMessage] = useState(
    lead.outreach.find((o) => o.type === 'sent_message')?.content ?? ''
  )
  const [savingSent, setSavingSent] = useState(false)
  const [sentSaved, setSentSaved] = useState(!!lead.outreach.find((o) => o.type === 'sent_message'))
  const [addingContact, setAddingContact] = useState(false)
  const [validation, setValidation] = useState<ValidationRecord | null>(lead.validation)
  const drawerRef = useRef<HTMLDivElement>(null)

  // Reset when lead changes
  useEffect(() => {
    setCurrentStage(lead.crm_stage)
    setCurrentChannel(lead.outreach_channel)
    setCurrentSegment(lead.segment)
    setReportContent(lead.outreach.find((o) => o.type === 'research_report')?.content ?? null)
    setSentMessage(lead.outreach.find((o) => o.type === 'sent_message')?.content ?? '')
    setSentSaved(!!lead.outreach.find((o) => o.type === 'sent_message'))
    setValidation(lead.validation)
    setShowReport(false)
  }, [lead.id, lead.crm_stage, lead.outreach_channel, lead.segment, lead.outreach, lead.validation])

  const handleSegmentChange = async (segment: Segment | '') => {
    setCurrentSegment(segment)
    await fetch(`/api/leads/${lead.id}/segment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ segment }),
    })
    onSegmentChange(lead.id, segment)
  }

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

  const handleChannelChange = async (channel: OutreachChannel) => {
    setCurrentChannel(channel)
    await fetch(`/api/leads/${lead.id}/channel`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel }),
    })
    onChannelChange(lead.id, channel)
  }

  const handleSaveSent = async () => {
    if (!sentMessage.trim()) return
    setSavingSent(true)
    try {
      const res = await fetch(`/api/leads/${lead.id}/sent-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: sentMessage.trim() }),
      })
      if (res.ok) {
        setSentSaved(true)
        onSentMessageSaved(lead.id, sentMessage.trim())
      }
    } finally {
      setSavingSent(false)
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
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${WORKLOADS[lead.use_case]?.chip ?? 'bg-gray-100 text-gray-600'}`}>
                {WORKLOADS[lead.use_case]?.label ?? lead.use_case}
              </span>
              <span className="text-xs text-gray-400">Tier {lead.tier}</span>
              {lead.company_size && <span className="text-xs text-gray-400">· {lead.company_size}</span>}
              {lead.funding && <span className="text-xs text-gray-400">· {lead.funding}</span>}
            </div>
          </div>
          <button onClick={onClose} className="flex-shrink-0 text-gray-400 hover:text-gray-600 text-lg leading-none mt-0.5">✕</button>
        </div>

        {/* Stage + channel row */}
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex-shrink-0">Stage</span>
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

        {/* Segment selector */}
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex-shrink-0">Segment</span>
          <div className="flex gap-1.5 flex-wrap">
            {SEGMENT_KEYS.map((s) => (
              <button
                key={s}
                onClick={() => handleSegmentChange(currentSegment === s ? '' : s)}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium border transition-colors ${
                  currentSegment === s
                    ? SEGMENTS[s].chip + ' ring-1 ring-inset ring-current'
                    : 'bg-gray-100 text-gray-400 border-transparent hover:text-gray-600'
                }`}
              >
                {SEGMENTS[s].short}
              </button>
            ))}
          </div>
        </div>

        {/* Channel selector — shown once stage is outreach_sent or beyond */}
        {['outreach_sent','follow_up_due','replied','call_scheduled','post_call','in_evaluation','proposal_sent','nurture','closed_won','closed_lost'].includes(currentStage) && (
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex-shrink-0">Channel</span>
            <div className="flex gap-1.5">
              {(['linkedin', 'x', 'telegram'] as OutreachChannel[]).map((ch) => (
                <button
                  key={ch}
                  onClick={() => handleChannelChange(ch)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    currentChannel === ch
                      ? CHANNEL_CONFIG[ch].badge + ' ring-1 ring-inset ring-current'
                      : 'bg-gray-100 text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {CHANNEL_CONFIG[ch].label}
                </button>
              ))}
            </div>
          </div>
        )}

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
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Why it fits</p>
            <p className="text-sm text-gray-700 leading-relaxed">{lead.why_boundless_fits}</p>
          </div>

          {/* Validation record — built up from analyzed conversations */}
          {validation && <ValidationSection validation={validation} />}

          {/* Contacts */}
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Contacts</p>
              <button
                onClick={() => setAddingContact(true)}
                className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
              >
                + Add
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {lead.contacts.map((c) => (
                <EditableContact key={c.id} contact={c} onSaved={(updated) => onContactUpdated(lead.id, updated)} />
              ))}
              {lead.contacts.length === 0 && !addingContact && (
                <p className="text-sm text-gray-400">No contacts on file</p>
              )}
              {addingContact && (
                <AddContactForm
                  leadId={lead.id}
                  onSaved={(c) => { onContactAdded(lead.id, c); setAddingContact(false) }}
                  onCancel={() => setAddingContact(false)}
                />
              )}
            </div>
          </div>

          {/* Sent message log */}
          {['outreach_sent','follow_up_due','replied','call_scheduled','post_call','in_evaluation','proposal_sent','nurture','closed_won','closed_lost'].includes(currentStage) && (
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Sent message</p>
              <textarea
                value={sentMessage}
                onChange={(e) => { setSentMessage(e.target.value); setSentSaved(false) }}
                placeholder="Paste the message you sent..."
                rows={4}
                className="w-full text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-gray-300 mb-2"
              />
              <button
                onClick={handleSaveSent}
                disabled={savingSent || !sentMessage.trim() || sentSaved}
                className="h-8 px-3 text-xs font-medium rounded-full bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40 transition-colors"
              >
                {savingSent ? 'Saving...' : sentSaved ? 'Saved' : 'Save message'}
              </button>
            </div>
          )}

          {/* Conversations — transcripts, replies, notes → analyzed */}
          <ConversationsSection
            lead={lead}
            currentStage={currentStage}
            onValidationUpdated={setValidation}
            onApplyStage={handleStageChange}
          />

          {/* Actions */}
          <div className="px-5 py-4 flex flex-col gap-2.5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Actions</p>

            {/* Outreach */}
            <button
              onClick={onOpenOutreach}
              className="w-full h-10 flex items-center justify-center gap-2 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  <ThinkingOrb state="composing" size={20} theme="light" />
                  Generating prep brief...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
  const [addToSegment, setAddToSegment] = useState<Segment | null>(null)

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

  const handleDrop = useCallback(async (leadId: string, newStage: CRMStage) => {
    const lead = leads.find((l) => l.id === leadId)
    if (!lead || lead.crm_stage === newStage) return
    const now = new Date().toISOString()
    const update = { crm_stage: newStage, ...(newStage === 'outreach_sent' ? { outreach_sent_at: now } : {}) }
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, ...update } : l))
    if (selectedLead?.id === leadId) setSelectedLead((prev) => prev ? { ...prev, ...update } : null)
    await fetch(`/api/leads/${leadId}/stage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: newStage }),
    })
  }, [leads, selectedLead])

  const handleStageChange = (leadId: string, stage: CRMStage) => {
    const now = new Date().toISOString()
    setLeads((prev) => prev.map((l) =>
      l.id === leadId
        ? { ...l, crm_stage: stage, ...(stage === 'outreach_sent' ? { outreach_sent_at: now } : {}) }
        : l
    ))
  }

  const handleChannelChange = (leadId: string, channel: OutreachChannel) => {
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, outreach_channel: channel } : l))
    if (selectedLead?.id === leadId) setSelectedLead((prev) => prev ? { ...prev, outreach_channel: channel } : null)
  }

  const handleSegmentChange = (leadId: string, segment: Segment | '') => {
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, segment } : l))
    if (selectedLead?.id === leadId) setSelectedLead((prev) => prev ? { ...prev, segment } : null)
  }

  const handleCompanyAdded = (lead: LeadWithContacts) => {
    setLeads((prev) => [lead, ...prev])
  }

  const handleContactAdded = (leadId: string, contact: Contact) => {
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, contacts: [...l.contacts, contact] } : l))
    if (selectedLead?.id === leadId) {
      setSelectedLead((prev) => prev ? { ...prev, contacts: [...prev.contacts, contact] } : null)
    }
  }

  const handleContactUpdated = (leadId: string, contact: Contact) => {
    setLeads((prev) => prev.map((l) =>
      l.id === leadId ? { ...l, contacts: l.contacts.map((c) => c.id === contact.id ? contact : c) } : l
    ))
    if (selectedLead?.id === leadId) {
      setSelectedLead((prev) => prev ? { ...prev, contacts: prev.contacts.map((c) => c.id === contact.id ? contact : c) } : null)
    }
  }

  const handleSentMessageSaved = (leadId: string, content: string) => {
    const newEntry = { id: '', lead_id: leadId, contact_id: null, type: 'sent_message' as const, content, generated_at: new Date().toISOString() }
    setLeads((prev) => prev.map((l) =>
      l.id === leadId ? { ...l, outreach: [...l.outreach.filter(o => o.type !== 'sent_message'), newEntry] } : l
    ))
    if (selectedLead?.id === leadId) {
      setSelectedLead((prev) => prev ? { ...prev, outreach: [...prev.outreach.filter(o => o.type !== 'sent_message'), newEntry] } : null)
    }
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

  // Partition by segment, then by stage within each segment band.
  // Leads that predate the experiment (segment = '') land in "Unassigned".
  const bands: Array<{ key: Segment | ''; leads: LeadWithContacts[] }> = [
    ...SEGMENT_KEYS.map((s) => ({ key: s as Segment | '', leads: filteredLeads.filter((l) => l.segment === s) })),
    { key: '', leads: filteredLeads.filter((l) => !l.segment || !(SEGMENT_KEYS as string[]).includes(l.segment)) },
  ]

  const stagesFor = (bandLeads: LeadWithContacts[]): Record<CRMStage, LeadWithContacts[]> => {
    const byStage = {} as Record<CRMStage, LeadWithContacts[]>
    for (const s of ALL_STAGES) byStage[s] = []
    for (const l of bandLeads) {
      // Priority leads float to top of their column
      if (l.is_priority) byStage[l.crm_stage]?.unshift(l)
      else byStage[l.crm_stage]?.push(l)
    }
    return byStage
  }

  const closedCount = filteredLeads.filter((l) => ['nurture', 'closed_won', 'closed_lost'].includes(l.crm_stage)).length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <ThinkingOrb state="working" size={64} theme="light" />
      </div>
    )
  }

  const COLUMN_H = 340

  return (
    <>
      <div className="flex flex-col bg-gray-50 min-h-[calc(100vh-56px)]">

        {/* Header */}
        <div className="sticky top-0 z-30 flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-white gap-4">
          <div className="flex-shrink-0">
            <h1 className="text-sm font-semibold text-gray-900">Pipeline</h1>
            <p className="text-xs text-gray-400">{leads.length} companies · 3 discovery segments</p>
          </div>

          {/* Service filter */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 flex-shrink-0 overflow-x-auto">
            {(['all', ...WORKLOAD_KEYS] as (UseCase | 'all')[]).map((f) => (
              <button
                key={f}
                onClick={() => setServiceFilter(f)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  serviceFilter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {f === 'all' ? 'All' : WORKLOADS[f].label}
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

        {/* Segment bands — page scrolls vertically, each band scrolls horizontally */}
        <div className="flex flex-col gap-6 px-4 py-4">
          {bands.map(({ key, leads: bandLeads }) => {
            const isUnassigned = key === ''
            if (isUnassigned && bandLeads.length === 0) return null
            const seg = isUnassigned ? null : SEGMENTS[key as Segment]
            const byStage = stagesFor(bandLeads)

            return (
              <section key={key || 'unassigned'} className={`bg-white rounded-2xl border ${seg?.band ?? 'border-gray-200'} overflow-hidden`}>
                {/* Band header */}
                <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border flex-shrink-0 ${seg?.chip ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                      {seg?.short ?? 'Unassigned'}
                    </span>
                    <h2 className="text-sm font-semibold text-gray-900 truncate">
                      {seg?.label ?? 'No segment yet — open a card to assign one'}
                    </h2>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {!isUnassigned && <SegmentProgress leads={bandLeads} />}
                    {!isUnassigned && (
                      <button
                        onClick={() => setAddToSegment(key as Segment)}
                        className="text-xs font-medium text-gray-400 hover:text-gray-700 border border-gray-200 hover:border-gray-300 rounded-lg px-2 py-1 transition-colors"
                        title={`Add a company to ${seg?.label}`}
                      >
                        + Add
                      </button>
                    )}
                  </div>
                </div>

                {/* Band board */}
                {bandLeads.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-gray-400">No accounts in this segment yet. Swipe right in the deck, use + Add, or assign existing cards.</div>
                ) : (
                  <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
                    <div className="flex gap-3 px-3 pt-3 pb-3" style={{ minWidth: 'max-content' }}>
                      {visibleStages.map((stage) => (
                        <div key={stage} style={{ width: 220, height: COLUMN_H, display: 'flex', flexDirection: 'column' }}>
                          <BoardColumn
                            stage={stage}
                            leads={byStage[stage]}
                            onCardClick={(lead) => setSelectedLead(lead)}
                            onDrop={handleDrop}
                            onTogglePriority={handleTogglePriority}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )
          })}
        </div>
      </div>

      {/* Drawer */}
      {selectedLead && (
        <LeadDrawer
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onStageChange={handleStageChange}
          onChannelChange={handleChannelChange}
          onSegmentChange={handleSegmentChange}
          onOpenOutreach={() => setOutreachLead(selectedLead)}
          onReportGenerated={handleReportGenerated}
          onSentMessageSaved={handleSentMessageSaved}
          onContactUpdated={handleContactUpdated}
          onContactAdded={handleContactAdded}
        />
      )}

      {/* Outreach modal */}
      {outreachLead && (
        <OutreachModal lead={outreachLead} onClose={() => setOutreachLead(null)} />
      )}

      {/* Add company modal */}
      {addToSegment && (
        <AddCompanyModal
          segment={addToSegment}
          onAdded={handleCompanyAdded}
          onClose={() => setAddToSegment(null)}
        />
      )}
    </>
  )
}
