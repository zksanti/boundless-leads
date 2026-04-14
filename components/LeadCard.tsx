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

        <h2 className="text-2xl font-bold text-gray-900 mb-2 leading-tight">
          {lead.company_name}
        </h2>
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
