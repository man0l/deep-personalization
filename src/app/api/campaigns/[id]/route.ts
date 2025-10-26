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

export async function POST(req: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  // Action endpoint: { action: 'purge_queued' | 'duplicate' }
  const p: any = await (context.params as any)
  const id = (p?.id || p?.then ? (await (context.params as Promise<{ id: string }>)).id : p.id)
  const body = await req.json().catch(()=>({}))
  const supa = supabaseServer()
  if (body?.action === 'duplicate') {
    // Duplicate campaign settings only (no leads/files)
    const { data: original, error: cErr } = await supa.from('campaigns').select('*').eq('id', id).single()
    if (cErr || !original) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    const copyName = `${original.name} (Copy)`
    const { data: created, error } = await supa
      .from('campaigns')
      .insert({
        name: copyName,
        service_line: original.service_line,
        summarize_prompt: original.summarize_prompt,
        icebreaker_prompt: original.icebreaker_prompt,
      })
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ duplicated: true, campaign: created })
  }
  if (body?.action !== 'purge_queued') return NextResponse.json({ error: 'unsupported action' }, { status: 400 })
  // Purge queue messages (best-effort) and mark queued leads as none
  try { await supa.rpc('purge_lead_enrichment') } catch {}
  const { error } = await supa.from('leads').update({ ice_status: 'none' }).eq('campaign_id', id).eq('ice_status', 'queued')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ purged: true })
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  const p: any = await (context.params as any)
  const id = (p?.id || p?.then ? (await (context.params as Promise<{ id: string }>)).id : p.id)
  const supa = supabaseServer()
  // Deleting the campaign cascades to related leads and enrichment_jobs (see schema)
  const { error } = await supa.from('campaigns').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}


