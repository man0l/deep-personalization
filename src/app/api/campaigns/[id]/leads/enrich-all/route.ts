import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> | { id: string } }) {
  const p: any = await (context.params as any)
  const campaignId = (p?.id || p?.then ? (await (context.params as Promise<{ id: string }>)).id : p.id)
  const searchParams = new URL(req.url).searchParams

  const hasIce = searchParams.get('hasIce')
  const status = searchParams.get('status') || undefined
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
  const verification = searchParams.get('verification') || undefined
  const enriched_from = searchParams.get('enriched_from') || undefined
  const enriched_to = searchParams.get('enriched_to') || undefined

  const supa = supabaseServer()
  const selectCols = 'id,campaign_id,ice_status'
  let query: any = supa.from('leads').select(selectCols).eq('campaign_id', campaignId)
  
  if (hasIce === 'true') query = query.eq('ice_status', 'done')
  if (hasIce === 'false') query = query.neq('ice_status', 'done')
  if (status && ['done','queued','processing','error','none'].includes(status)) query = query.eq('ice_status', status)
  if (verification && ['unverified','queued','verified_ok','verified_bad','verified_unknown'].includes(verification)) query = query.eq('verification_status', verification)
  if (enriched_from) {
    try { query = query.gte('enriched_at', new Date(enriched_from).toISOString()) } catch {}
  }
  if (enriched_to) {
    try { const d = new Date(enriched_to); d.setUTCDate(d.getUTCDate()+1); query = query.lt('enriched_at', d.toISOString()) } catch {}
  }
  if (q) query = query.or(`ilike(first_name,%${q}%),ilike(last_name,%${q}%),ilike(full_name,%${q}%),ilike(company_name,%${q}%),ilike(email,%${q}%),ilike(personal_email,%${q}%),ilike(title,%${q}%),ilike(industry,%${q}%)`)
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
  if (sortBy) query = query.order(sortBy, { ascending: (sortDir ?? 'asc') === 'asc', nullsFirst: false })
  else query = query.order('created_at', { ascending: false })

  // Fetch in chunks
  const chunkSize = 1000
  let offset = 0
  const leads: { id: string, campaign_id: string, ice_status: string }[] = []
  while (true) {
    const to = Math.max(offset, offset + chunkSize - 1)
    const { data, error } = await query.range(offset, to)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data || data.length === 0) break
    for (const d of data as any[]) {
      leads.push({ id: d.id, campaign_id: d.campaign_id, ice_status: d.ice_status })
    }
    if (data.length < chunkSize) break
    offset += chunkSize
  }

  if (leads.length === 0) return NextResponse.json({ error: 'No leads to enrich', queued: 0 })

  // Enrich all filtered leads
  let queued = 0
  for (const lead of leads) {
    // Only queue if not already done
    if (lead.ice_status !== 'done') {
      await supa.from('leads').update({ ice_status: 'queued' }).eq('id', lead.id)
    }
    // Ensure a job record exists (idempotent)
    const { error: jobErr } = await supa
      .from('enrichment_jobs')
      .upsert({ lead_id: lead.id, campaign_id: lead.campaign_id, status: 'queued', error: null }, { onConflict: 'lead_id' })
    if (jobErr) continue
    // Push to pgmq (idempotent-ish; duplicates are acceptable for our worker which acks per lead)
    const { error: rpcErr } = await supa.rpc('enqueue_lead_enrichment', { lid: lead.id })
    if (!rpcErr) queued++
  }

  return NextResponse.json({ queued, total: leads.length })
}

