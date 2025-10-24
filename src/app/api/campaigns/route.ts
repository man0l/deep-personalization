import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function GET() {
  const supa = supabaseServer()
  const { data, error } = await supa.from('campaigns').select('*').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ campaigns: data })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, service_line, summarize_prompt, icebreaker_prompt } = body || {}
  if (!name || !service_line || !summarize_prompt || !icebreaker_prompt) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  const supa = supabaseServer()
  const { data, error } = await supa
    .from('campaigns')
    .insert({ name, service_line, summarize_prompt, icebreaker_prompt })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ campaign: data }, { status: 201 })
}


