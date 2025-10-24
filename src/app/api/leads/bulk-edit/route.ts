import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const ids: string[] = body?.ids || []
  const updates: Record<string, any> = body?.updates || {}
  if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ updated: 0 })
  const allowed = ['first_name','last_name','full_name','company_name','company_website','email','personal_email','linkedin','title','industry','city','state','country','ice_breaker','ice_status']
  for (const key of Object.keys(updates)) if (!allowed.includes(key)) delete updates[key]
  if (Object.keys(updates).length === 0) return NextResponse.json({ updated: 0 })
  const supa = supabaseServer()
  const { error, count } = await supa.from('leads').update(updates, { count: 'exact' }).in('id', ids)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ updated: count ?? 0 })
}


