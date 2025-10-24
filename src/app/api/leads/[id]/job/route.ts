import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function GET(_req: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  const p: any = await (context.params as any)
  const id = (p?.id || p?.then ? (await (context.params as Promise<{ id: string }>)).id : p.id)
  const supa = supabaseServer()
  const { data, error } = await supa
    .from('enrichment_jobs')
    .select('status,error,created_at,updated_at')
    .eq('lead_id', id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ job: data || null })
}


