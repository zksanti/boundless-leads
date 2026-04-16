export type UseCase = 'payments' | 'yield' | 'treasury' | 'tokenization'
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
  tier: Tier
  company_size: string
  funding: string
  why_boundless_fits: string
  status: LeadStatus
  crm_stage: CRMStage
  is_priority: boolean
  outreach_channel: OutreachChannel | null
  outreach_sent_at: string | null
  created_at: string
  swiped_at: string | null
  snooze_until: string | null
}

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
  type: 'linkedin_connection' | 'linkedin_dm' | 'email' | 'research_report' | 'sent_message'
  content: string
  generated_at: string
}

export interface LeadWithContacts extends Lead {
  contacts: Contact[]
  outreach: Outreach[]
}
