import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const body = await req.json().catch(()=>null)
  if (!body || !Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json({ error: 'ids required' }, { status: 400 })
  }
  const ids: string[] = Array.from(new Set((body.ids as any[]).map(String))).filter(Boolean) as string[]
  const action: 'status'|'delete' = body.action
  const supa = supabaseServer()

  if (action === 'status') {
    const status = String(body.status || '').trim()
    if (!['none','queued','processing','done','error'].includes(status)) {
      return NextResponse.json({ error: 'invalid status' }, { status: 400 })
    }
    const { data, error } = await supa.from('leads').update({ ice_status: status }).in('id', ids).select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ updated: data?.length ?? 0 })
  }

  if (action === 'delete') {
    const { data, error } = await supa.from('leads').delete().in('id', ids).select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ deleted: data?.length ?? 0 })
  }

  return NextResponse.json({ error: 'unsupported action' }, { status: 400 })
}


