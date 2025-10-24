import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> | { id: string } }) {
  const p: any = await (context.params as any)
  const campaignId = (p?.id || p?.then ? (await (context.params as Promise<{ id: string }>)).id : p.id)
  const searchParams = new URL(_req.url).searchParams
  const page = Number(searchParams.get('page') || '1')
  const pageSize = Math.min(Number(searchParams.get('pageSize') || '50'), 200)
  const hasIce = searchParams.get('hasIce')
  const q = searchParams.get('q')?.trim().toLowerCase()
  const sortBy = searchParams.get('sortBy') || undefined
  const sortDir = (searchParams.get('sortDir') as 'asc' | 'desc' | null) || undefined
  const idsOnly = searchParams.get('idsOnly') === 'true'
  const f_full_name = searchParams.get('f_full_name') || undefined
  const f_title = searchParams.get('f_title') || undefined
  const f_company_name = searchParams.get('f_company_name') || undefined
  const f_email = searchParams.get('f_email') || undefined

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
  if (f_full_name) query = query.ilike('full_name', `%${f_full_name}%`)
  if (f_title) query = query.ilike('title', `%${f_title}%`)
  if (f_company_name) query = query.ilike('company_name', `%${f_company_name}%`)
  if (f_email) query = query.ilike('email', `%${f_email}%`)
  if (idsOnly) {
    if (sortBy) {
      query = query.order(sortBy, { ascending: (sortDir ?? 'asc') === 'asc', nullsFirst: false })
    } else {
      query = query.order('created_at', { ascending: false })
    }
    const fromIds = (page - 1) * pageSize
    const toIds = Math.max(fromIds, fromIds + pageSize - 1)
    const { data, error } = await query.select('id').range(fromIds, toIds)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ids: (data || []).map((d: any) => d.id), page, pageSize })
  } else {
    const from = (page - 1) * pageSize
    const to = Math.max(from, from + pageSize - 1)
    if (sortBy) {
      query = query.order(sortBy, { ascending: (sortDir ?? 'asc') === 'asc', nullsFirst: false })
    } else {
      query = query.order('created_at', { ascending: false })
    }
    const { data, error, count } = await query.range(from, to)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ leads: data, page, pageSize, total: count ?? 0 })
  }
}


