import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(()=>({}))
  const ids: string[] = Array.isArray(body?.ids) ? body.ids : []
  const campaignId: string | undefined = body?.campaignId
  if (!ids.length) return NextResponse.json({ error: null, fileId: null })

  const apiKey = process.env.EMAIL_LIST_VERIFY_KEY || process.env.ELV_API_KEY || ''
  if (!apiKey) return NextResponse.json({ error: 'Missing EMAIL_LIST_VERIFY_KEY' }, { status: 500 })

  const supa = supabaseServer()
  const { data: leads, error } = await supa
    .from('leads')
    .select('id,email,campaign_id')
    .in('id', ids)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const valid = (leads || []).filter((l:any)=> l.email && String(l.email).length>3)
  if (valid.length === 0) return NextResponse.json({ error: 'No emails to verify', fileId: null })

  // Optional sanity check that all belong to same campaign if campaignId is provided
  const inferredCampaignId = campaignId || (valid[0] as any).campaign_id

  // Build text file with one email per line
  const content = valid.map((l:any)=> String(l.email).toLowerCase()).join('\n') + '\n'
  const filename = `campaign-${inferredCampaignId}-selected-${Date.now()}.txt`

  // Upload to EmailListVerify bulk endpoint
  const form = new FormData()
  form.append('file_contents', new Blob([content], { type: 'text/plain' }) as any, filename)
  const url = `https://apps.emaillistverify.com/api/verifyApiFile?secret=${encodeURIComponent(apiKey)}&filename=${encodeURIComponent(filename)}`
  const res = await fetch(url, { method: 'POST', body: form as any })
  const text = (await res.text()).trim()
  if (!res.ok || !text) return NextResponse.json({ error: text || 'Bulk upload failed' }, { status: 500 })
  const fileId = text

  // Persist file tracking
  await supa.from('email_verification_files').insert({
    campaign_id: inferredCampaignId,
    source: 'selected',
    file_id: fileId,
    filename,
    lines: valid.length,
    filter_query: null,
  })

  // Mark these leads as queued for verification
  await supa
    .from('leads')
    .update({ verification_status: 'queued', verification_checked_at: null })
    .in('id', valid.map((l:any)=> l.id))

  return NextResponse.json({ fileId })
}


