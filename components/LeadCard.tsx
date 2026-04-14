import type { Lead } from '@/lib/types'

const USE_CASE_CONFIG = {
  payments: { label: 'Payments', color: 'bg-blue-50 text-blue-700 border-blue-100' },
  yield: { label: 'Yield', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  treasury: { label: 'Treasury', color: 'bg-violet-50 text-violet-700 border-violet-100' },
  tokenization: { label: 'Tokenization', color: 'bg-amber-50 text-amber-700 border-amber-100' },
}

interface Props {
  lead: Lead
  dimmed?: boolean
}

export default function LeadCard({ lead, dimmed = false }: Props) {
  const uc = USE_CASE_CONFIG[lead.use_case] ?? USE_CASE_CONFIG.payments

  return (
    <div
      className={`w-full rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden select-none transition-opacity ${
        dimmed ? 'opacity-60' : 'opacity-100'
      }`}
    >
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${uc.color}`}
          >
            {uc.label}
          </span>
          <span className="text-xs text-gray-400 font-medium">
            Tier {lead.tier}
          </span>
        </div>

        <div className="flex items-start justify-between gap-3 mb-2">
          <h2 className="text-2xl font-bold text-gray-900 leading-tight">
            {lead.company_name}
          </h2>
          {lead.website_url && (
            <a
              href={lead.website_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex-shrink-0 mt-1 text-gray-400 hover:text-gray-600 transition-colors"
              title={lead.website_url}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
        </div>

        {/* Company metadata */}
        {(lead.company_size || lead.funding) && (
          <div className="flex flex-wrap gap-3 mb-3">
            {lead.company_size && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {lead.company_size}
              </span>
            )}
            {lead.funding && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {lead.funding}
              </span>
            )}
          </div>
        )}

        <p className="text-gray-500 text-sm leading-relaxed">
          {lead.description}
        </p>
      </div>

      {/* Divider */}
      <div className="mx-6 border-t border-gray-100" />

      {/* Signal */}
      <div className="px-6 py-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
          Signal
        </p>
        <p className="text-sm text-gray-700 leading-relaxed">
          {lead.signal}
        </p>
      </div>

      {/* Why it fits */}
      <div className="mx-6 border-t border-gray-100" />
      <div className="px-6 py-4 pb-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
          Why it fits
        </p>
        <p className="text-sm text-gray-700 leading-relaxed">
          {lead.why_boundless_fits}
        </p>
      </div>
    </div>
  )
}
