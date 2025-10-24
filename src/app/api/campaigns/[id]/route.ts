import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = params.id
  const { data: campaign, error: cErr } = await supabaseServer.from('campaigns').select('*').eq('id', id).single()
  if (cErr || !campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  const { data: counts, error: sErr } = await supabaseServer
    .from('leads')
    .select('ice_status, count:count(*)')
    .eq('campaign_id', id)
    .group('ice_status')
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 })

  const totals: Record<string, number> = { total: 0 }
  for (const row of counts || []) {
    totals[row.ice_status] = (totals[row.ice_status] || 0) + Number(row.count)
    totals.total += Number(row.count)
  }
  return NextResponse.json({ campaign, totals })
}


