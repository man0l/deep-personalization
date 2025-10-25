import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> | { id: string } }) {
  const p: any = await (context.params as any)
  const campaignId = (p?.id || p?.then ? (await (context.params as Promise<{ id: string }>)).id : p.id)
  const searchParams = new URL(_req.url).searchParams
  const page = Number(searchParams.get('page') || '1')
  const pageSize = Math.min(Number(searchParams.get('pageSize') || '50'), 200)
  const hasIce = searchParams.get('hasIce')
  const status = searchParams.get('status') || undefined
  const q = searchParams.get('q')?.trim().toLowerCase()
  const sortBy = searchParams.get('sortBy') || undefined
  const sortDir = (searchParams.get('sortDir') as 'asc' | 'desc' | null) || undefined
  const idsOnly = searchParams.get('idsOnly') === 'true'
  const includeTotals = searchParams.get('includeTotals') === '1' || searchParams.get('includeTotals') === 'true'
  const f_full_name = searchParams.get('f_full_name') || undefined
  const f_title = searchParams.get('f_title') || undefined
  const f_company_name = searchParams.get('f_company_name') || undefined
  const f_email = searchParams.get('f_email') || undefined

  const supa = supabaseServer()
  const selectCols = 'id,first_name,last_name,full_name,company_name,company_website,email,personal_email,title,industry,city,state,country,ice_breaker,ice_status,enriched_at,created_at'
  let query: any
  if (idsOnly) {
    query = supa.from('leads').select('id').eq('campaign_id', campaignId)
  } else {
    query = supa.from('leads').select(selectCols, { count: 'exact' }).eq('campaign_id', campaignId)
  }
  if (hasIce === 'true') query = query.eq('ice_status', 'done')
  if (hasIce === 'false') query = query.neq('ice_status', 'done')
  if (status && ['done','queued','processing','error','none'].includes(status)) {
    query = query.eq('ice_status', status)
  }
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
    const fromIds = (page - 1) * pageSize
    const toIds = Math.max(fromIds, fromIds + pageSize - 1)
    if (sortBy) {
      query = query.order(sortBy, { ascending: (sortDir ?? 'asc') === 'asc', nullsFirst: false })
    } else {
      query = query.order('created_at', { ascending: false })
    }
    const { data, error } = await query.range(fromIds, toIds)
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
    const [listRes, totalsRes] = await Promise.all([
      query.range(from, to),
      includeTotals
        ? Promise.all([
            supa.from('leads').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId),
            supa.from('leads').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('ice_status', 'done'),
            supa.from('leads').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('ice_status', 'queued'),
            supa.from('leads').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('ice_status', 'processing'),
            supa.from('leads').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('ice_status', 'error'),
          ])
        : (null as any),
    ])
    const { data, error, count } = listRes as any
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    let totals: any = undefined
    if (includeTotals && totalsRes) {
      const [totalRes, doneRes, queuedRes, processingRes, errorRes] = totalsRes as any
      for (const r of [totalRes, doneRes, queuedRes, processingRes, errorRes]) {
        if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 })
      }
      totals = {
        total: totalRes.count ?? 0,
        done: doneRes.count ?? 0,
        queued: queuedRes.count ?? 0,
        processing: processingRes.count ?? 0,
        error: errorRes.count ?? 0,
      }
    }
    return NextResponse.json({ leads: data, page, pageSize, total: count ?? 0, totals })
  }
}


