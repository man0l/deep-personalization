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
    email: r['Email'] ?? null,
    personal_email: r['Personal Email'] ?? null,
    linkedin: r['LinkedIn'] ?? null,
    title: r['Title'] ?? null,
    industry: r['Industry'] ?? null,
    city: r['City'] ?? null,
    state: r['State'] ?? null,
    country: r['Country'] ?? null,
    raw: r,
  }))

  const chunkSize = 500
  let inserted = 0
  const supa = supabaseServer()
  for (let i = 0; i < mapped.length; i += chunkSize) {
    const chunk = mapped.slice(i, i + chunkSize)
    const { error, count } = await supa
      .from('leads')
      .insert(chunk, { count: 'exact' })
      .select('id')
    if (error) {
      // try dedupe-aware upsert by email
      const { error: upsertErr, count: upsertCount } = await supa
        .from('leads')
        .upsert(chunk, { onConflict: 'campaign_id,email', ignoreDuplicates: false, count: 'exact' })
        .select('id')
      if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 })
      inserted += upsertCount ?? 0
    } else {
      inserted += count ?? 0
    }
  }

  return NextResponse.json({ inserted })
}


