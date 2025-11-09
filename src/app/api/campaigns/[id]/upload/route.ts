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

  // Helper function to get value from either CamelCase or snake_case column names
  const getValue = (row: any, camelCase: string, snakeCase: string): string | null => {
    return row[camelCase] ?? row[snakeCase] ?? null
  }

  // Map common Apollo headers to our columns, store full row into raw
  // Supports both CamelCase (e.g., "First Name") and snake_case (e.g., "first_name") column names
  const mapped = rows.map((r) => {
    const firstName = getValue(r, 'First Name', 'first_name')
    const lastName = getValue(r, 'Last Name', 'last_name')
    const fullName = getValue(r, 'Full Name', 'full_name') ?? (([firstName, lastName].filter(Boolean).join(' ')) || null)
    const companyWebsite = getValue(r, 'Company Website', 'company_website') || getValue(r, 'Company Domain', 'company_domain') || ''
    const email = getValue(r, 'Email', 'email')
    const personalEmail = getValue(r, 'Personal Email', 'personal_email')

    return {
      campaign_id: campaignId,
      first_name: firstName,
      last_name: lastName,
      full_name: fullName,
      company_name: getValue(r, 'Company Name', 'company_name'),
      company_website: companyWebsite.replace(/^https?:\/\//, '') || null,
      email: email ? String(email).toLowerCase() : null,
      personal_email: personalEmail ? String(personalEmail).toLowerCase() : null,
      linkedin: getValue(r, 'LinkedIn', 'linkedin'),
      title: getValue(r, 'Title', 'title'),
      industry: getValue(r, 'Industry', 'industry'),
      city: getValue(r, 'City', 'city'),
      state: getValue(r, 'State', 'state'),
      country: getValue(r, 'Country', 'country'),
      raw: r,
    }
  })

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


