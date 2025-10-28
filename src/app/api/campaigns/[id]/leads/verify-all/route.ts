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

  const apiKey = process.env.EMAIL_LIST_VERIFY_KEY || process.env.ELV_API_KEY || ''
  if (!apiKey) return NextResponse.json({ error: 'Missing EMAIL_LIST_VERIFY_KEY' }, { status: 500 })

  const supa = supabaseServer()
  const selectCols = 'id,email'
  let query: any = supa.from('leads').select(selectCols).eq('campaign_id', campaignId)
  if (hasIce === 'true') query = query.eq('ice_status', 'done')
  if (hasIce === 'false') query = query.neq('ice_status', 'done')
  if (status && ['done','queued','processing','error','none'].includes(status)) query = query.eq('ice_status', status)
  if (verification && ['unverified','queued','verified_ok','verified_bad','verified_unknown'].includes(verification)) query = query.eq('verification_status', verification)
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
  const emails: { id: string, email: string }[] = []
  while (true) {
    const to = Math.max(offset, offset + chunkSize - 1)
    const { data, error } = await query.range(offset, to)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data || data.length === 0) break
    for (const d of data as any[]) {
      if (d.email && String(d.email).length > 3) emails.push({ id: d.id, email: d.email })
    }
    if (data.length < chunkSize) break
    offset += chunkSize
  }

  if (emails.length === 0) return NextResponse.json({ error: 'No emails to verify', fileId: null, scanned: 0 })

  // Build content and upload to ELV as a file
  const content = emails.map(e=> e.email.toLowerCase()).join('\n') + '\n'
  const filename = `campaign-${campaignId}-filtered-${Date.now()}.txt`
  const form = new FormData()
  form.append('file_contents', new Blob([content], { type: 'text/plain' }) as any, filename)
  const url = `https://apps.emaillistverify.com/api/verifyApiFile?secret=${encodeURIComponent(apiKey)}&filename=${encodeURIComponent(filename)}`
  const resUpload = await fetch(url, { method: 'POST', body: form as any })
  const fileId = (await resUpload.text()).trim()
  if (!resUpload.ok || !fileId) return NextResponse.json({ error: fileId || 'Bulk upload failed' }, { status: 500 })

  // Persist tracking row with filters snapshot
  const filterQuery: any = {}
  for (const [k,v] of searchParams.entries()) filterQuery[k] = v
  await supa.from('email_verification_files').insert({
    campaign_id: campaignId,
    source: 'filtered',
    file_id: fileId,
    filename,
    lines: emails.length,
    filter_query: filterQuery,
  })

  // Mark matching leads as queued for verification (chunked)
  const ids = emails.map(e=> e.id)
  const chunk = 500
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk)
    await supa
      .from('leads')
      .update({ verification_status: 'queued', verification_checked_at: null })
      .in('id', slice)
  }

  return NextResponse.json({ fileId, scanned: emails.length })
}


