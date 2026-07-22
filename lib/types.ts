// Workload segments for the inference-cloud ICP. The DB column is still named
// `use_case` for migration simplicity, but it now carries the GPU-workload type.
export type UseCase = 'evals' | 'synth_data' | 'agents' | 'docs' | 'media' | 'batch'

// Discovery segments from the Customer Discovery Experiment (July 2026).
// Orthogonal to UseCase: segment = who the company is, use_case = what they run.
// '' on a lead means it predates the experiment and is unassigned.
export type Segment = 'platforms' | 'media_gen' | 'agents_pt'
export type Tier = 1 | 2
export type SwipeDirection = 'right' | 'left' | 'down'
export type LeadStatus = 'pending' | 'accepted' | 'rejected' | 'snoozed'
export type CRMStage =
  | 'needs_outreach'
  | 'outreach_sent'
  | 'follow_up_due'
  | 'replied'
  | 'call_scheduled'
  | 'post_call'
  | 'in_evaluation'
  | 'proposal_sent'
  | 'nurture'
  | 'closed_won'
  | 'closed_lost'

export type OutreachChannel = 'linkedin' | 'x' | 'telegram'

export interface Lead {
  id: string
  company_name: string
  website_url: string
  description: string
  signal: string
  use_case: UseCase
  segment: Segment | ''
  company_linkedin_url: string
  tier: Tier
  company_size: string
  funding: string
  why_boundless_fits: string
  status: LeadStatus
  crm_stage: CRMStage
  is_priority: boolean
  outreach_channel: OutreachChannel | null
  outreach_sent_at: string | null
  rejection_reason: string
  validation: ValidationRecord | null
  created_at: string
  swiped_at: string | null
  snooze_until: string | null
}

// Account research record from the experiment doc, built up conversation by
// conversation. Lives as one JSONB column on the lead; merged in code so an
// "unknown" from a short reply never overwrites a confirmed value.
export interface ValidationRecord {
  workload: string
  workload_status: 'confirmed' | 'denied' | 'unknown'
  current_provider: string
  pain: string
  blockers: string[]
  fit_confidence: 'high' | 'medium' | 'low' | ''
  open_questions: string[]
  next_step: string
}

export interface ConversationAnalysis {
  primary_tag: string | null
  secondary_tag: string | null
  validation: ValidationRecord
  suggested_stage: CRMStage | null
  stage_rationale: string
  learnings: Array<{ category: 'icp' | 'messaging'; content: string }>
  summary: string
}

export interface Conversation {
  id: string
  lead_id: string
  kind: string
  content: string
  occurred_at: string
  primary_tag: string
  secondary_tag: string
  analysis: ConversationAnalysis | null
  analyzed_at: string | null
  created_at: string
}

export interface Learning {
  id: string
  category: 'icp' | 'messaging'
  segment: Segment | ''
  content: string
  source: 'conversation' | 'manual'
  conversation_id: string | null
  lead_id: string | null
  status: 'pending' | 'accepted' | 'rejected'
  auto_applied: boolean
  user_feedback: string
  created_at: string
  responded_at: string | null
}

// Versioned living ICP per segment. segments.ts is the v0 seed; once a profile
// is active for a segment, lead generation reads the profile instead of the
// static qualification/exclude/signals arrays.
export interface ICPProfile {
  id: string
  segment: Segment
  version: number
  qualification: string[]
  exclude: string[]
  signals: string[]
  guidance: string
  change_summary: string
  status: 'pending' | 'active' | 'rejected' | 'superseded'
  source_counts: Record<string, number>
  created_at: string
  responded_at: string | null
}

export type LearningMode = 'review' | 'auto'

export interface PatternInsight {
  id: string
  swipe_milestone: number
  insight: string
  refinement: string
  status: 'pending' | 'accepted' | 'rejected'
  user_feedback: string
  created_at: string
  responded_at: string | null
}

export interface SearchRefinement {
  id: string
  content: string
  source: 'ai' | 'manual'
  created_at: string
  active: boolean
}

export interface Contact {
  id: string
  lead_id: string
  name: string
  title: string
  email: string
  linkedin_url: string
  twitter_url: string
  is_primary: boolean
}

export interface Pattern {
  use_case: UseCase
  tier: number
  right_swipes: number
  left_swipes: number
}

export interface Outreach {
  id: string
  lead_id: string
  contact_id: string | null
  type: 'linkedin_connection' | 'linkedin_dm' | 'email' | 'x_dm' | 'research_report' | 'sent_message'
  content: string
  generated_at: string
}

export interface LeadWithContacts extends Lead {
  contacts: Contact[]
  outreach: Outreach[]
}
