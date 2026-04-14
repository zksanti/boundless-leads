'use client'

import { useState } from 'react'
import type { LeadWithContacts } from '@/lib/types'

interface Props {
  lead: LeadWithContacts
  onClose: () => void
}

type Tab = 'linkedin_connection' | 'linkedin_dm' | 'email'

const TAB_LABELS: Record<Tab, string> = {
  linkedin_connection: 'Connection Note',
  linkedin_dm: 'LinkedIn DM',
  email: 'Email',
}

export default function OutreachModal({ lead, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('linkedin_connection')
  const [outreach, setOutreach] = useState<Record<Tab, string>>({
    linkedin_connection: '',
    linkedin_dm: '',
    email: '',
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [copied, setCopied] = useState(false)

  const primaryContact = lead.contacts.find((c) => c.is_primary) || lead.contacts[0] || null

  // Pre-fill from stored outreach if available
  useState(() => {
    if (lead.outreach.length > 0) {
      const stored: Partial<Record<Tab, string>> = {}
      for (const item of lead.outreach) {
        if (item.type in TAB_LABELS) {
          stored[item.type as Tab] = item.content
        }
      }
      setOutreach((prev) => ({ ...prev, ...stored }))
      setGenerated(true)
    }
  })

  const generate = async () => {
    setIsGenerating(true)
    try {
      const res = await fetch(`/api/outreach/${lead.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: primaryContact?.id || null }),
      })
      const data = await res.json()
      if (data.outreach) {
        setOutreach({
          linkedin_connection: data.outreach.linkedin_connection || '',
          linkedin_dm: data.outreach.linkedin_dm || '',
          email: data.outreach.email || '',
        })
        setGenerated(true)
      }
    } finally {
      setIsGenerating(false)
    }
  }

  const copy = async () => {
    const text = outreach[activeTab]
    if (!text) return
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">{lead.company_name}</h2>
            {primaryContact && (
              <p className="text-sm text-gray-500 mt-0.5">
                {primaryContact.name} · {primaryContact.title}
                {primaryContact.linkedin_url && (
                  <>
                    {' '}·{' '}
                    <a
                      href={primaryContact.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      LinkedIn
                    </a>
                  </>
                )}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none ml-4"
          >
            ✕
          </button>
        </div>

        {/* Contacts list */}
        {lead.contacts.length > 1 && (
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex gap-3 overflow-x-auto">
            {lead.contacts.map((c) => (
              <a
                key={c.id}
                href={c.linkedin_url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-300 transition-colors"
              >
                <span className="font-medium">{c.name}</span>
                <span className="text-gray-400"> · {c.title}</span>
              </a>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="px-6 pt-4 flex gap-2">
          {(Object.keys(TAB_LABELS) as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {generated ? (
            <textarea
              value={outreach[activeTab]}
              onChange={(e) =>
                setOutreach((prev) => ({ ...prev, [activeTab]: e.target.value }))
              }
              rows={7}
              className="w-full text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl p-4 resize-none focus:outline-none focus:ring-2 focus:ring-gray-900 font-mono leading-relaxed"
            />
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
              Generate outreach to see drafts
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex items-center gap-3">
          {!generated ? (
            <button
              onClick={generate}
              disabled={isGenerating}
              className="flex-1 h-10 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Drafting...
                </>
              ) : (
                'Generate outreach'
              )}
            </button>
          ) : (
            <>
              <button
                onClick={generate}
                disabled={isGenerating}
                className="h-10 px-4 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {isGenerating ? '...' : 'Regenerate'}
              </button>
              <button
                onClick={copy}
                className="flex-1 h-10 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
