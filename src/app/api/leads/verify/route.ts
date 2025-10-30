import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import net from 'node:net'
import { resolveMx } from 'node:dns/promises'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type SmtpResult = 'ok' | 'bad' | 'unknown'

async function resolveMailExchangers(domain: string): Promise<{ exchange: string, priority: number }[]> {
  try {
    const mx = await resolveMx(domain)
    if (!mx || mx.length === 0) return []
    return mx.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
  } catch {
    return []
  }
}

function readReply(socket: net.Socket, timeoutMs: number): Promise<{ code: number, text: string }> {
  return new Promise((resolve, reject) => {
    let buffer = ''
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString('utf8')
      // SMTP replies end when the status code is followed by a space instead of '-'
      const lines = buffer.split(/\r?\n/).filter(l => l)
      if (lines.length === 0) return
      const last = lines[lines.length - 1]
      const m = last.match(/^(\d{3})\s(.*)$/)
      if (m) {
        cleanup()
        resolve({ code: parseInt(m[1], 10), text: buffer })
      }
    }
    const onError = (err: Error) => { cleanup(); reject(err) }
    const onClose = () => { cleanup(); reject(new Error('SMTP connection closed')) }
    const onTimeout = () => { cleanup(); reject(new Error('SMTP timeout')) }
    const cleanup = () => {
      socket.off('data', onData)
      socket.off('error', onError)
      socket.off('close', onClose)
      socket.setTimeout(0)
      socket.off('timeout', onTimeout)
    }
    socket.on('data', onData)
    socket.on('error', onError)
    socket.on('close', onClose)
    socket.setTimeout(timeoutMs, onTimeout)
  })
}

async function smtpProbe(host: string, email: string): Promise<SmtpResult> {
  return new Promise<SmtpResult>((resolve) => {
    const socket = net.createConnection(25, host)
    let finished = false

    const finalize = (result: SmtpResult) => {
      if (finished) return
      finished = true
      try { socket.end() } catch {}
      resolve(result)
    }

    const send = (line: string) => {
      socket.write(line + '\r\n')
    }

    const step = async () => {
      try {
        // Greet
        let r = await readReply(socket, 8000)
        if (r.code >= 500) return finalize('unknown')

        send(`HELO verifier.local`)
        r = await readReply(socket, 8000)
        if (r.code >= 500) return finalize('unknown')

        // Use a neutral MAIL FROM that most servers accept syntactically
        send(`MAIL FROM:<postmaster@verifier.local>`) 
        r = await readReply(socket, 8000)
        if (r.code >= 500) return finalize('unknown')

        send(`RCPT TO:<${email}>`)
        r = await readReply(socket, 10000)

        // Interpret RCPT response
        if (r.code === 250) {
          send('QUIT')
          return finalize('ok')
        }
        if (r.code === 550 && /5\.1\.1|user unknown|no such user/i.test(r.text)) {
          send('QUIT')
          return finalize('bad')
        }
        // Greylisting/deferrals/temporary failures → unknown
        if ([421, 450, 451, 452].includes(r.code)) {
          send('QUIT')
          return finalize('unknown')
        }

        send('QUIT')
        return finalize('unknown')
      } catch {
        return finalize('unknown')
      }
    }

    socket.once('connect', step)
    socket.once('error', () => finalize('unknown'))
    socket.setTimeout(15000, () => finalize('unknown'))
  })
}

async function verifyEmailSmtp(email: string): Promise<SmtpResult> {
  const at = email.indexOf('@')
  if (at <= 0 || at === email.length - 1) return 'bad'
  const domain = email.slice(at + 1).toLowerCase()
  const mx = await resolveMailExchangers(domain)
  if (mx.length === 0) return 'bad'

  // Try MX hosts in order of priority
  for (const rec of mx) {
    const res = await smtpProbe(rec.exchange, email)
    if (res !== 'unknown') return res
  }
  return 'unknown'
}

function mapResultToStatus(r: SmtpResult): 'verified_ok' | 'verified_bad' | 'verified_unknown' {
  if (r === 'ok') return 'verified_ok'
  if (r === 'bad') return 'verified_bad'
  return 'verified_unknown'
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(()=>({}))
  const ids: string[] = Array.isArray(body?.ids) ? body.ids : []
  if (!ids.length) return NextResponse.json({ error: 'No ids provided' }, { status: 400 })

  const supa = supabaseServer()
  const { data: leads, error } = await supa
    .from('leads')
    .select('id,email')
    .in('id', ids)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const valid = (leads || []).filter((l:any)=> l.email && String(l.email).includes('@'))
  if (valid.length === 0) return NextResponse.json({ error: 'No emails to verify' }, { status: 400 })

  // Concurrency limit
  const limit = 5
  let idx = 0
  const results: { id: string, status: 'verified_ok'|'verified_bad'|'verified_unknown' }[] = []

  async function worker() {
    while (true) {
      const i = idx++
      if (i >= valid.length) break
      const lead = valid[i] as any
      const res = await verifyEmailSmtp(String(lead.email).toLowerCase())
      results.push({ id: lead.id, status: mapResultToStatus(res) })
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, valid.length) }, () => worker()))

  // Update DB (batched by small chunks to avoid payload limits)
  const now = new Date().toISOString()
  const chunkSize = 100
  for (let i = 0; i < results.length; i += chunkSize) {
    const slice = results.slice(i, i + chunkSize)
    for (const r of slice) {
      await supa
        .from('leads')
        .update({ verification_status: r.status, verification_checked_at: now })
        .eq('id', r.id)
    }
  }

  const ok = results.filter(r=> r.status === 'verified_ok').length
  const bad = results.filter(r=> r.status === 'verified_bad').length
  const unknown = results.filter(r=> r.status === 'verified_unknown').length

  // Keep fileId in payload for backward UI compatibility (null)
  return NextResponse.json({ fileId: null, processed: results.length, ok, bad, unknown })
}


