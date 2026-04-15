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
  created_at: string
  swiped_at: string | null
  snooze_until: string | null
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
  type: 'linkedin_connection' | 'linkedin_dm' | 'email' | 'research_report'
  content: string
  generated_at: string
}

export interface LeadWithContacts extends Lead {
  contacts: Contact[]
  outreach: Outreach[]
}
