import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const leadIds: string[] = body?.leadIds || []
  if (!Array.isArray(leadIds) || leadIds.length === 0) return NextResponse.json({ queued: 0 })

  const QUEUE_NAME = process.env.QUEUE_NAME || 'lead-enrichment'

  // Enqueue into pgmq via RPC and also record enrichment_jobs for audit/status
  const supa = supabaseServer()
  let queued = 0
  for (const leadId of leadIds) {
    const { data: lead, error: leadErr } = await supa.from('leads').select('id,campaign_id,ice_status').eq('id', leadId).single()
    if (leadErr || !lead || lead.ice_status === 'done') continue
    await supa.from('leads').update({ ice_status: 'queued' }).eq('id', lead.id)
    const { error } = await supa
      .from('enrichment_jobs')
      .insert({ lead_id: lead.id, campaign_id: lead.campaign_id, status: 'queued' })
    if (!error) {
      // push to pgmq
      const { error: rpcErr } = await supa.rpc('enqueue_lead_enrichment', { lid: lead.id })
      if (!rpcErr) queued++
    }
  }

  return NextResponse.json({ queued, queue: QUEUE_NAME })
}


