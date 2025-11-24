import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> | { id: string } }) {
  const p: any = await (context.params as any)
  const campaignId = (p?.id || p?.then ? (await (context.params as Promise<{ id: string }>)).id : p.id)
  
  const body = await req.json().catch(() => ({}))
  const ids: string[] = Array.isArray(body?.ids) ? body.ids : []
  if (!ids.length) return NextResponse.json({ error: 'No ids provided' }, { status: 400 })

  const apiKey = process.env.EMAIL_MILLIONVERIFIER_KEY || ''
  if (!apiKey) return NextResponse.json({ error: 'Missing EMAIL_MILLIONVERIFIER_KEY' }, { status: 500 })

  const supa = supabaseServer()
  const { data: leads, error } = await supa
    .from('leads')
    .select('id,email')
    .eq('campaign_id', campaignId)
    .in('id', ids)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const valid = (leads || []).filter((l: any) => l.email && String(l.email).includes('@'))
  if (valid.length === 0) return NextResponse.json({ error: 'No emails to verify', fileId: null, scanned: 0 })

  // Build content and upload to MillionVerifier as a file
  const content = valid.map(e => e.email.toLowerCase()).join('\n') + '\n'
  const filename = `campaign-${campaignId}-selected-${Date.now()}.txt`
  const form = new FormData()
  form.append('file_contents', new Blob([content], { type: 'text/plain' }) as any, filename)
  const url = `https://bulkapi.millionverifier.com/bulkapi/v2/upload?key=${encodeURIComponent(apiKey)}&remove_duplicates=1`
  const resUpload = await fetch(url, { method: 'POST', body: form as any })
  
  // MillionVerifier returns JSON with file_id field, or plain text file_id
  let fileId: string | null = null
  const responseText = await resUpload.text().catch(() => '')
  
  if (!resUpload.ok) {
    return NextResponse.json({ error: responseText || 'Bulk upload failed' }, { status: 500 })
  }
  
  // Try to parse as JSON first
  try {
    const uploadResponse = JSON.parse(responseText)
    if (uploadResponse && typeof uploadResponse === 'object') {
      // Extract file_id from the response - check multiple possible field names
      fileId = uploadResponse.file_id || 
               uploadResponse.fileId || 
               uploadResponse.id || 
               uploadResponse.fileid ||
               uploadResponse.FILE_ID ||
               null
    }
  } catch {
    // If not JSON, treat as plain text file_id
    fileId = responseText.trim() || null
  }
  
  if (!fileId) {
    return NextResponse.json({ error: 'Bulk upload failed: no file_id returned' }, { status: 500 })
  }

  // Persist tracking row
  await supa.from('email_verification_files').insert({
    campaign_id: campaignId,
    source: 'selected',
    file_id: fileId,
    filename,
    lines: valid.length,
    filter_query: { source: 'selected', ids },
    emails: valid.map(e => e.email.toLowerCase()),
  })

  // Mark matching leads as queued for verification (chunked)
  const leadIds = valid.map(e => e.id)
  const chunk = 500
  for (let i = 0; i < leadIds.length; i += chunk) {
    const slice = leadIds.slice(i, i + chunk)
    await supa
      .from('leads')
      .update({ verification_status: 'queued', verification_checked_at: null })
      .in('id', slice)
  }

  return NextResponse.json({ fileId, scanned: valid.length })
}

