export type Lead = {
  id: string
  first_name: string | null
  last_name: string | null
  full_name: string | null
  company_name: string | null
  company_website: string | null
  email: string | null
  title: string | null
  industry: string | null
  city: string | null
  state: string | null
  country: string | null
  ice_breaker: string | null
  ice_status: string
  enriched_at?: string | null
  verification_status?: string | null
  verification_checked_at?: string | null
}


