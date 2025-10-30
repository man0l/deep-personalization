import { NextRequest } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function csvEscape(value: any): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  const escaped = str.replace(/"/g, '""')
  return `"${escaped}"`
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> | { id: string } }) {
  const p: any = await (context.params as any)
  const campaignId = (p?.id || p?.then ? (await (context.params as Promise<{ id: string }>)).id : p.id)
  const searchParams = new URL(req.url).searchParams

  const hasIce = searchParams.get('hasIce')
  const status = searchParams.get('status') || undefined
  const verification = searchParams.get('verification') || undefined
  const q = searchParams.get('q')?.trim().toLowerCase()
  const sortBy = searchParams.get('sortBy') || undefined
  const sortDir = (searchParams.get('sortDir') as 'asc' | 'desc' | null) || undefined
  const f_full_name = searchParams.get('f_full_name') || undefined
  const f_title = searchParams.get('f_title') || undefined
  const f_company_name = searchParams.get('f_company_name') || undefined
  const f_email = searchParams.get('f_email') || undefined
  const f_company_website_like = searchParams.get('f_company_website_like') || undefined
  const f_company_website_empty = searchParams.get('f_company_website_empty') === '1' || searchParams.get('f_company_website_empty') === 'true'
  const f_company_website_not_empty = searchParams.get('f_company_website_not_empty') === '1' || searchParams.get('f_company_website_not_empty') === 'true'
  const f_email_like = searchParams.get('f_email_like') || undefined
  const f_email_empty = searchParams.get('f_email_empty') === '1' || searchParams.get('f_email_empty') === 'true'
  const f_email_not_empty = searchParams.get('f_email_not_empty') === '1' || searchParams.get('f_email_not_empty') === 'true'
  const idsParam = searchParams.get('ids')
  const ids = idsParam ? idsParam.split(',').map(s=> s.trim()).filter(Boolean) : undefined
  const enriched_from = searchParams.get('enriched_from') || undefined
  const enriched_to = searchParams.get('enriched_to') || undefined
  const verified_from = searchParams.get('verified_from') || undefined
  const verified_to = searchParams.get('verified_to') || undefined

  const selectCols = 'id,first_name,last_name,full_name,company_name,company_website,email,personal_email,linkedin,title,industry,city,state,country,ice_breaker,ice_status,enriched_at,verification_status,verification_checked_at,created_at'
  const supa = supabaseServer()

  function buildBaseQuery() {
    let query: any = supa.from('leads').select(selectCols).eq('campaign_id', campaignId)
    if (ids && ids.length > 0) query = query.in('id', ids)
    if (hasIce === 'true') query = query.eq('ice_status', 'done')
    if (hasIce === 'false') query = query.neq('ice_status', 'done')
    if (status && ['done','queued','processing','error','none'].includes(status)) {
      query = query.eq('ice_status', status)
    }
    if (q) {
      query = query.or(
        `ilike(first_name,%${q}%),ilike(last_name,%${q}%),ilike(full_name,%${q}%),ilike(company_name,%${q}%),ilike(email,%${q}%),ilike(personal_email,%${q}%),ilike(title,%${q}%),ilike(industry,%${q}%),ilike(ice_breaker,%${q}%)`
      )
    }
    if (verification && ['unverified','queued','verified_ok','verified_bad','verified_unknown'].includes(verification)) {
      query = query.eq('verification_status', verification)
    }
    if (f_full_name) query = query.ilike('full_name', `%${f_full_name}%`)
    if (f_title) query = query.ilike('title', `%${f_title}%`)
    if (f_company_name) query = query.ilike('company_name', `%${f_company_name}%`)
    if (f_email) query = query.ilike('email', `%${f_email}%`)
    if (f_company_website_like) query = query.ilike('company_website', `%${f_company_website_like}%`)
    if (f_company_website_empty && !f_company_website_not_empty) query = query.or('company_website.is.null,company_website.eq.')
    if (f_company_website_not_empty && !f_company_website_empty) query = query.not('company_website', 'is', null).neq('company_website','')
    if (f_email_like) query = query.ilike('email', `%${f_email_like}%`)
    if (f_email_empty && !f_email_not_empty) query = query.or('email.is.null,email.eq.')
    if (f_email_not_empty && !f_email_empty) query = query.not('email', 'is', null).neq('email','')
    if (enriched_from) { try { query = query.gte('enriched_at', new Date(enriched_from).toISOString()) } catch {} }
    if (enriched_to) { try { const d = new Date(enriched_to); d.setUTCDate(d.getUTCDate()+1); query = query.lt('enriched_at', d.toISOString()) } catch {} }
    if (verified_from) { try { query = query.gte('verification_checked_at', new Date(verified_from).toISOString()) } catch {} }
    if (verified_to) { try { const d = new Date(verified_to); d.setUTCDate(d.getUTCDate()+1); query = query.lt('verification_checked_at', d.toISOString()) } catch {} }
    if (sortBy) {
      query = query.order(sortBy, { ascending: (sortDir ?? 'asc') === 'asc', nullsFirst: false })
    } else {
      query = query.order('created_at', { ascending: false })
    }
    return query
  }

  const rows: any[] = []
  const chunkSize = 1000
  let offset = 0
  while (true) {
    const to = Math.max(offset, offset + chunkSize - 1)
    const { data, error } = await buildBaseQuery().range(offset, to)
    if (error) {
      return new Response(error.message, { status: 500 })
    }
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < chunkSize) break
    offset += chunkSize
  }

  const headers = [
    'id','first_name','last_name','full_name','company_name','company_website','email','personal_email','linkedin','title','industry','city','state','country','ice_status','enriched_at','verification_status','verified_at','ice_breaker','created_at'
  ]
  const lines: string[] = []
  lines.push(headers.map(csvEscape).join(','))
  for (const r of rows) {
    const line = [
      r.id,
      r.first_name,
      r.last_name,
      r.full_name,
      r.company_name,
      r.company_website,
      r.email,
      r.personal_email,
      r.linkedin,
      r.title,
      r.industry,
      r.city,
      r.state,
      r.country,
      r.ice_status,
      r.enriched_at,
      r.verification_status,
      r.verification_checked_at,
      r.ice_breaker,
      r.created_at,
    ].map(csvEscape).join(',')
    lines.push(line)
  }

  const body = `\uFEFF${lines.join('\n')}`
  // Lookup campaign name for nicer filename
  let safeBase = `campaign-${campaignId}`
  try {
    const { data: campaign } = await supa.from('campaigns').select('name').eq('id', campaignId).single()
    const name = (campaign?.name || '').toString()
    if (name) {
      safeBase = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || safeBase
    }
  } catch {}
  const fileName = `${safeBase}-leads-${new Date().toISOString().replace(/[:.]/g,'-')}.csv`
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  })
}


