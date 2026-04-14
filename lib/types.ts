export type UseCase = 'payments' | 'yield' | 'treasury' | 'tokenization'
export type Tier = 1 | 2
export type SwipeDirection = 'right' | 'left' | 'down'
export type LeadStatus = 'pending' | 'accepted' | 'rejected' | 'snoozed'

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
  type: 'linkedin_connection' | 'linkedin_dm' | 'email'
  content: string
  generated_at: string
}

export interface LeadWithContacts extends Lead {
  contacts: Contact[]
  outreach: Outreach[]
}
