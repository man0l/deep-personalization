import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type VerifyResult = 'verified_ok' | 'verified_bad' | 'verified_unknown'

function mapStatus(s: string): VerifyResult {
  const v = s.toLowerCase()
  if (v === 'ok' || v === 'valid') return 'verified_ok'
  if (v.includes('invalid') || v.includes('failed') || v.includes('syntax')) return 'verified_bad'
  return 'verified_unknown'
}

async function verifyEmail(apiKey: string, email: string): Promise<VerifyResult> {
  const url = `https://apps.emaillistverify.com/api/verifyEmail?secret=${encodeURIComponent(apiKey)}&email=${encodeURIComponent(email)}`
  try {
    const res = await fetch(url, { method: 'GET' })
    const text = (await res.text()).trim()
    if (!res.ok) return 'verified_unknown'
    return mapStatus(text)
  } catch {
    return 'verified_unknown'
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(()=>({}))
  const ids: string[] = Array.isArray(body?.ids) ? body.ids : []
  if (!ids.length) return NextResponse.json({ updated: 0, error: null })

  const apiKey = process.env.EMAIL_LIST_VERIFY_KEY || process.env.ELV_API_KEY || ''
  if (!apiKey) return NextResponse.json({ error: 'Missing EMAIL_LIST_VERIFY_KEY' }, { status: 500 })

  const supa = supabaseServer()
  const { data: leads, error } = await supa
    .from('leads')
    .select('id,email')
    .in('id', ids)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const toCheck = (leads || []).filter(l=> (l as any).email && String((l as any).email).length>3)

  let updated = 0
  const now = new Date().toISOString()
  const concurrency = 5
  let i = 0
  while (i < toCheck.length) {
    const slice = toCheck.slice(i, i + concurrency)
    const results = await Promise.all(slice.map(async (l: any)=>{
      const status = await verifyEmail(apiKey, l.email)
      return { id: l.id, status }
    }))
    for (const r of results) {
      const { error: upErr } = await supa
        .from('leads')
        .update({ verification_status: r.status, verification_checked_at: now })
        .eq('id', r.id)
      if (!upErr) updated++
    }
    i += concurrency
  }

  return NextResponse.json({ updated })
}


