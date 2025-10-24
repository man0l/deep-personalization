import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const ids: string[] = body?.ids || []
  if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ deleted: 0 })
  const { error, count } = await supabaseServer.from('leads').delete({ count: 'exact' }).in('id', ids)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: count ?? 0 })
}


