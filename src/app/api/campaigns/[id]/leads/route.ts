import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: campaignId } = await context.params
  const searchParams = new URL(_req.url).searchParams
  const page = Number(searchParams.get('page') || '1')
  const pageSize = Math.min(Number(searchParams.get('pageSize') || '50'), 200)
  const hasIce = searchParams.get('hasIce')
  const q = searchParams.get('q')?.trim().toLowerCase()

  const supa = supabaseServer()
  let query = supa.from('leads').select('*', { count: 'exact' }).eq('campaign_id', campaignId)
  if (hasIce === 'true') query = query.eq('ice_status', 'done')
  if (hasIce === 'false') query = query.neq('ice_status', 'done')
  if (q) {
    // Simple OR search across common fields
    query = query.or(
      `ilike(first_name,%${q}%),ilike(last_name,%${q}%),ilike(full_name,%${q}%),ilike(company_name,%${q}%),ilike(email,%${q}%),ilike(personal_email,%${q}%),ilike(title,%${q}%),ilike(industry,%${q}%)`
    )
  }
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ leads: data, page, pageSize, total: count ?? 0 })
}


