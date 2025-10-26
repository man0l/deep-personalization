import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { supabaseServer } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export default async function CampaignsHome() {
  // Query directly from the server to avoid relative fetch issues
  let campaigns: any[] = []
  try {
    const supa = supabaseServer()
    const { data } = await supa.from('campaigns').select('*').order('created_at', { ascending: false })
    campaigns = data || []
    // attach quick stats per campaign
    await Promise.all(
      campaigns.map(async (c) => {
        const totalRes = await supa.from('leads').select('id', { count: 'exact', head: true }).eq('campaign_id', c.id)
        const doneRes = await supa.from('leads').select('id', { count: 'exact', head: true }).eq('campaign_id', c.id).eq('ice_status', 'done')
        const queuedRes = await supa.from('leads').select('id', { count: 'exact', head: true }).eq('campaign_id', c.id).eq('ice_status', 'queued')
        const errorRes = await supa.from('leads').select('id', { count: 'exact', head: true }).eq('campaign_id', c.id).eq('ice_status', 'error')
        c._stats = {
          total: totalRes.count ?? 0,
          done: doneRes.count ?? 0,
          queued: queuedRes.count ?? 0,
          error: errorRes.count ?? 0,
        }
      })
    )
  } catch {
    campaigns = []
  }
  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-violet-300">Campaigns</h1>
        <Button asChild className="bg-violet-600 hover:bg-violet-500 text-white">
          <Link href="/campaigns/new">Create Campaign</Link>
        </Button>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {campaigns.map((c) => (
          <Card key={c.id} className="bg-zinc-900 border-zinc-800 hover:border-violet-700/60 transition-colors">
            <CardHeader>
              <CardTitle className="text-zinc-100">{c.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-400 line-clamp-3">{c.service_line}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="secondary" className="bg-zinc-800 border-zinc-700">Total {c._stats?.total ?? 0}</Badge>
                <Badge className="bg-emerald-700/40 text-emerald-300 hover:bg-emerald-700/50">Done {c._stats?.done ?? 0}</Badge>
                <Badge className="bg-violet-700/40 text-violet-300 hover:bg-violet-700/50">Queued {c._stats?.queued ?? 0}</Badge>
                <Badge className="bg-red-700/40 text-red-300 hover:bg-red-700/50">Error {c._stats?.error ?? 0}</Badge>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button asChild variant="secondary" className="bg-zinc-800 text-zinc-200 hover:bg-zinc-700">
                  <Link href={`/campaigns/${c.id}/edit`}>Edit</Link>
                </Button>
                <form action={async ()=>{
                  'use server'
                  // call duplicate action
                  await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/api/campaigns/${c.id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'duplicate' })
                  }).catch(()=>{})
                  revalidatePath('/campaigns')
                }}>
                  <Button type="submit" variant="secondary" className="bg-zinc-800 text-zinc-200 hover:bg-zinc-700">
                    Duplicate
                  </Button>
                </form>
                <Button asChild variant="secondary" className="bg-violet-700/30 text-violet-300 hover:bg-violet-700/50">
                  <Link href={`/campaigns/${c.id}`}>Open</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {campaigns.length === 0 && (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-6 text-zinc-400">No campaigns yet.</CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}


