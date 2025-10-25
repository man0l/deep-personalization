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
    if (leadErr || !lead) continue
    if (lead.ice_status !== 'done') {
      await supa.from('leads').update({ ice_status: 'queued' }).eq('id', lead.id)
    }
    // ensure a job record exists (idempotent)
    const { error: jobErr } = await supa
      .from('enrichment_jobs')
      .upsert({ lead_id: lead.id, campaign_id: lead.campaign_id, status: 'queued', error: null }, { onConflict: 'lead_id' })
    if (jobErr) continue
    // push to pgmq (idempotent-ish; duplicates are acceptable for our worker which acks per lead)
    const { error: rpcErr } = await supa.rpc('enqueue_lead_enrichment', { lid: lead.id })
    if (!rpcErr) queued++
  }

  return NextResponse.json({ queued, queue: QUEUE_NAME })
}


