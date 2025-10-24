import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function GET(_req: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  const p: any = await (context.params as any)
  const id = (p?.id || p?.then ? (await (context.params as Promise<{ id: string }>)).id : p.id)
  const supa = supabaseServer()
  const { data: campaign, error: cErr } = await supa.from('campaigns').select('*').eq('id', id).single()
  if (cErr || !campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  const totals: Record<string, number> = { total: 0, done: 0, queued: 0, processing: 0, error: 0 }
  const totalRes = await supa.from('leads').select('id', { count: 'exact', head: true }).eq('campaign_id', id)
  if (totalRes.error) return NextResponse.json({ error: totalRes.error.message }, { status: 500 })
  totals.total = totalRes.count ?? 0
  for (const st of ['done','queued','processing','error'] as const) {
    const r = await supa.from('leads').select('id', { count: 'exact', head: true }).eq('campaign_id', id).eq('ice_status', st)
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 })
    totals[st] = r.count ?? 0
  }
  return NextResponse.json({ campaign, totals })
}


