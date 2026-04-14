'use client'

import { useState, useEffect } from 'react'
import OutreachModal from '@/components/OutreachModal'
import type { LeadWithContacts } from '@/lib/types'

const USE_CASE_COLOR: Record<string, string> = {
  payments: 'bg-blue-50 text-blue-700',
  yield: 'bg-emerald-50 text-emerald-700',
  treasury: 'bg-violet-50 text-violet-700',
  tokenization: 'bg-amber-50 text-amber-700',
}

export default function QueuePage() {
  const [leads, setLeads] = useState<LeadWithContacts[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedLead, setSelectedLead] = useState<LeadWithContacts | null>(null)

  useEffect(() => {
    fetch('/api/queue')
      .then((r) => r.json())
      .then((data) => {
        setLeads(Array.isArray(data) ? data : [])
        setIsLoading(false)
      })
      .catch(() => setIsLoading(false))
  }, [])

  const exportMarkdown = (lead: LeadWithContacts) => {
    const primary = lead.contacts.find((c) => c.is_primary) || lead.contacts[0]
    const md = `# ${lead.company_name}
**Motion:** 2 — Direct ICP
**Stage:** Qualifying
**Primary contact:** ${primary ? `${primary.name} (${primary.title}) — ${primary.linkedin_url}` : '—'}
**Last touch:** ${lead.swiped_at ? lead.swiped_at.split('T')[0] : '—'}
**Next action:** —

---

## Intel (human-provided — highest priority)

-

---

## Research
_Last updated: ${new Date().toISOString().split('T')[0]}_

### What they do
${lead.description}

### Recent signals
- ${lead.signal}

### Inferred priorities

### How Boundless fits
${lead.why_boundless_fits}

---

## Deal notes

**Champion:** —
**Economic Buyer:** —
**Decision process:** —
**Known objections:** —
**Paper process notes:** —

---

## Materials generated
| Date | Type | File | Status |
|---|---|---|---|
| ${new Date().toISOString().split('T')[0]} | Outbound | — | Drafted (first touch) |
`
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${lead.company_name.toLowerCase().replace(/\s+/g, '-')}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

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
        <p className="text-gray-500">No accepted leads yet.</p>
        <p className="text-sm text-gray-400 mt-1">
          Swipe right on leads you want to pursue.
        </p>
      </main>
    )
  }

  return (
    <main className="max-w-xl mx-auto px-4 py-6">
      <div className="mb-5">
        <h1 className="text-base font-semibold text-gray-900">Outreach Queue</h1>
        <p className="text-xs text-gray-400 mt-0.5">{leads.length} leads to reach out to</p>
      </div>

      <div className="flex flex-col gap-3">
        {leads.map((lead) => {
          const primary = lead.contacts.find((c) => c.is_primary) || lead.contacts[0]
          const hasOutreach = lead.outreach.length > 0

          return (
            <div
              key={lead.id}
              className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-gray-300 transition-colors"
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <h2 className="font-semibold text-gray-900 truncate">{lead.company_name}</h2>
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{lead.signal}</p>
                </div>
                <span
                  className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                    USE_CASE_COLOR[lead.use_case] ?? 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {lead.use_case}
                </span>
              </div>

              {/* Contacts */}
              {lead.contacts.length > 0 ? (
                <div className="flex flex-wrap gap-2 mb-4">
                  {lead.contacts.map((c) => (
                    <a
                      key={c.id}
                      href={c.linkedin_url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-300 transition-colors"
                    >
                      <span className="text-gray-400">↗</span>
                      <span className="font-medium text-gray-700">{c.name}</span>
                      <span className="text-gray-400">{c.title}</span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 mb-4">No contacts added yet</p>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedLead(lead)}
                  className={`flex-1 h-9 rounded-xl text-sm font-medium transition-colors ${
                    hasOutreach
                      ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  }`}
                >
                  {hasOutreach ? 'View outreach' : 'Generate outreach'}
                </button>
                <button
                  onClick={() => exportMarkdown(lead)}
                  title="Export to CRM markdown"
                  className="h-9 px-3 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  ↓ CRM
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {selectedLead && (
        <OutreachModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
        />
      )}
    </main>
  )
}
