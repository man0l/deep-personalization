import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { parse } from 'csv-parse'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: campaignId } = await context.params
  const contentType = req.headers.get('content-type') || ''
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 })
  }
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Missing file' }, { status: 400 })

  const text = await file.text()
  const rows: any[] = []
  await new Promise<void>((resolve, reject) => {
    parse(text, { columns: true, skip_empty_lines: true }, (err, records) => {
      if (err) return reject(err)
      rows.push(...records)
      resolve()
    })
  })

  if (rows.length === 0) return NextResponse.json({ inserted: 0 })

  // Map common Apollo headers to our columns, store full row into raw
  const mapped = rows.map((r) => ({
    campaign_id: campaignId,
    first_name: r['First Name'] ?? null,
    last_name: r['Last Name'] ?? null,
    full_name: r['Full Name'] ?? (([r['First Name'], r['Last Name']].filter(Boolean).join(' ')) || null),
    company_name: r['Company Name'] ?? null,
    company_website: (r['Company Website'] || r['Company Domain'] || '').replace(/^https?:\/\//, '') || null,
    email: (r['Email'] ? String(r['Email']).toLowerCase() : null),
    personal_email: (r['Personal Email'] ? String(r['Personal Email']).toLowerCase() : null),
    linkedin: r['LinkedIn'] ?? null,
    title: r['Title'] ?? null,
    industry: r['Industry'] ?? null,
    city: r['City'] ?? null,
    state: r['State'] ?? null,
    country: r['Country'] ?? null,
    raw: r,
  }))

  // Deduplicate within this batch by (campaign_id,email) to avoid
  // "ON CONFLICT DO UPDATE command cannot affect row a second time".
  const deduped: typeof mapped = []
  const seen = new Set<string>()
  for (const m of mapped) {
    if (m.email) {
      const key = `${m.campaign_id}:${m.email}`
      if (seen.has(key)) continue
      seen.add(key)
      deduped.push(m)
    } else {
      deduped.push(m)
    }
  }

  const chunkSize = 500
  let inserted = 0
  const supa = supabaseServer()
  for (let i = 0; i < deduped.length; i += chunkSize) {
    const chunk = deduped.slice(i, i + chunkSize)
    const { error: upsertErr, count: upsertCount } = await supa
      .from('leads')
      .upsert(chunk, { onConflict: 'campaign_id,email', ignoreDuplicates: false, count: 'exact' })
      .select('id')
    if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 })
    inserted += upsertCount ?? 0
  }

  return NextResponse.json({ inserted })
}


