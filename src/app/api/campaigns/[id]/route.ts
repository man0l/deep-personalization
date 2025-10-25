import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function GET(_req: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  const p: any = await (context.params as any)
  const id = (p?.id || p?.then ? (await (context.params as Promise<{ id: string }>)).id : p.id)
  const supa = supabaseServer()
  const { data: campaign, error: cErr } = await supa.from('campaigns').select('*').eq('id', id).single()
  if (cErr || !campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  const totals: Record<string, number> = { total: 0, done: 0, queued: 0, processing: 0, error: 0 }
  const [totalRes, doneRes, queuedRes, processingRes, errorRes] = await Promise.all([
    supa.from('leads').select('id', { count: 'exact', head: true }).eq('campaign_id', id),
    supa.from('leads').select('id', { count: 'exact', head: true }).eq('campaign_id', id).eq('ice_status', 'done'),
    supa.from('leads').select('id', { count: 'exact', head: true }).eq('campaign_id', id).eq('ice_status', 'queued'),
    supa.from('leads').select('id', { count: 'exact', head: true }).eq('campaign_id', id).eq('ice_status', 'processing'),
    supa.from('leads').select('id', { count: 'exact', head: true }).eq('campaign_id', id).eq('ice_status', 'error'),
  ])
  for (const r of [totalRes, doneRes, queuedRes, processingRes, errorRes]) {
    if ((r as any).error) return NextResponse.json({ error: (r as any).error.message }, { status: 500 })
  }
  totals.total = totalRes.count ?? 0
  totals.done = doneRes.count ?? 0
  totals.queued = queuedRes.count ?? 0
  totals.processing = processingRes.count ?? 0
  totals.error = errorRes.count ?? 0
  return NextResponse.json({ campaign, totals })
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  const p: any = await (context.params as any)
  const id = (p?.id || p?.then ? (await (context.params as Promise<{ id: string }>)).id : p.id)
  const body = await req.json()
  const allowed = ['name','service_line','summarize_prompt','icebreaker_prompt']
  const updates: Record<string, any> = {}
  for (const k of allowed) if (k in body) updates[k] = body[k]
  if (Object.keys(updates).length === 0) return NextResponse.json({ updated: 0 })
  const supa = supabaseServer()
  const { error } = await supa.from('campaigns').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ updated: 1 })
}


