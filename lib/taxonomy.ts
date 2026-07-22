// Response taxonomy and funnel-diagnosis mapping from the "Boundless Customer
// Discovery" experiment doc. Single source of truth for conversation analysis
// (prompt definitions), tag validation, and the diagnosis strip on /patterns.
// Mirrors the segments.ts role: static, code-owned, no DB.

export const RESPONSE_TAGS = [
  { tag: 'no_relevant_workload', label: 'No relevant workload', definition: 'The prospect has no GPU workload Boundless could plausibly run.' },
  { tag: 'oai_anthropic_dependent', label: 'OAI/Anthropic dependent', definition: 'The product runs entirely on closed frontier APIs; nothing to migrate.' },
  { tag: 'does_not_control_deployment', label: 'No deployment control', definition: 'The team cannot choose where its models run (locked platform or vendor).' },
  { tag: 'too_early', label: 'Too early / low volume', definition: 'Real workload but volume too small for infrastructure cost to matter yet.' },
  { tag: 'cost_not_priority', label: 'Cost not a priority', definition: 'Compute cost exists but is not a problem they are motivated to solve now.' },
  { tag: 'capacity_availability_pain', label: 'Capacity/availability pain', definition: 'Their primary pain is getting enough GPUs or reliable availability, not price.' },
  { tag: 'happy_with_provider', label: 'Happy with provider', definition: 'Satisfied with their current infrastructure provider; no active reason to switch.' },
  { tag: 'latency_incompatible', label: 'Latency incompatible', definition: 'Their workload requires hard real-time latency Boundless cannot serve.' },
  { tag: 'compliance_blocker', label: 'Compliance blocker', definition: 'Compliance, security, or data-residency requirements block external capacity.' },
  { tag: 'needs_reliability_proof', label: 'Needs reliability proof', definition: 'Interested but needs evidence of uptime, stability, or operational maturity first.' },
  { tag: 'needs_hardware_details', label: 'Needs hardware details', definition: 'Wants specific hardware or architecture information before going further.' },
  { tag: 'needs_customer_reference', label: 'Needs customer reference', definition: 'Wants to see a comparable customer running production workloads first.' },
  { tag: 'needs_capacity_guarantee', label: 'Needs capacity guarantee', definition: 'Requires an SLA or guaranteed capacity commitment before evaluating.' },
  { tag: 'interested_later', label: 'Interested later', definition: 'Genuine interest but explicitly deferred to a later date or milestone.' },
  { tag: 'referred_to_owner', label: 'Referred to owner', definition: 'Pointed Boundless to the person who actually owns the technical decision.' },
  { tag: 'discovery_call_accepted', label: 'Discovery call accepted', definition: 'Agreed to a discovery conversation.' },
  { tag: 'benchmark_interest', label: 'Benchmark interest', definition: 'Expressed interest in benchmarking a representative workload.' },
  { tag: 'pilot_interest', label: 'Pilot interest', definition: 'Expressed interest in moving a production workload toward a pilot.' },
] as const

export type ResponseTag = (typeof RESPONSE_TAGS)[number]['tag']

export const RESPONSE_TAG_VALUES = RESPONSE_TAGS.map((t) => t.tag) as ResponseTag[]

export function tagLabel(tag: string): string {
  return RESPONSE_TAGS.find((t) => t.tag === tag)?.label ?? tag
}

// Funnel-diagnosis buckets from the experiment doc's diagnosis table. A tag's
// bucket says what a pile of such responses means for the segment.
export type DiagnosisBucket = 'targeting' | 'product_fit' | 'proof_assets' | 'timing' | 'positive'

export const TAG_DIAGNOSIS: Record<ResponseTag, DiagnosisBucket> = {
  no_relevant_workload: 'targeting',
  oai_anthropic_dependent: 'targeting',
  does_not_control_deployment: 'targeting',
  too_early: 'targeting',
  compliance_blocker: 'targeting',
  latency_incompatible: 'product_fit',
  cost_not_priority: 'timing',
  happy_with_provider: 'timing',
  interested_later: 'timing',
  needs_reliability_proof: 'proof_assets',
  needs_hardware_details: 'proof_assets',
  needs_customer_reference: 'proof_assets',
  needs_capacity_guarantee: 'proof_assets',
  capacity_availability_pain: 'positive',
  referred_to_owner: 'positive',
  discovery_call_accepted: 'positive',
  benchmark_interest: 'positive',
  pilot_interest: 'positive',
}

export const DIAGNOSIS_HINTS: Record<Exclude<DiagnosisBucket, 'positive'>, string> = {
  targeting: 'Replies are substantive but mostly no fit — a targeting/ICP problem. Tighten this segment’s qualification before sending more.',
  product_fit: 'Pain is real but the workload isn’t compatible — a product-fit problem for this segment’s hypothesis.',
  proof_assets: 'Prospects engage but want proof (reliability, hardware, references, SLAs) — build proof assets before scaling outreach.',
  timing: 'Fit exists but no urgency — revisit trigger quality and consider nurture over new outreach.',
}

export const CONVERSATION_KINDS = [
  { kind: 'call_transcript', label: 'Call transcript' },
  { kind: 'email_reply', label: 'Email reply' },
  { kind: 'linkedin_reply', label: 'LinkedIn reply' },
  { kind: 'x_reply', label: 'X reply' },
  { kind: 'notes', label: 'Notes' },
] as const

export type ConversationKind = (typeof CONVERSATION_KINDS)[number]['kind']

export const CONVERSATION_KIND_VALUES = CONVERSATION_KINDS.map((k) => k.kind) as ConversationKind[]

export function kindLabel(kind: string): string {
  return CONVERSATION_KINDS.find((k) => k.kind === kind)?.label ?? kind
}

// Preset chips for the optional "why did you pass?" prompt after a left swipe.
export const REJECTION_PRESETS = [
  'Too big / too late-stage',
  'Closed-API only',
  'No GPU workload',
  'Competitor',
  'Weak signal',
] as const
