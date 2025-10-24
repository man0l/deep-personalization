import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

async function fetchCampaigns() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/campaigns`, { cache: 'no-store' })
  if (!res.ok) return [] as any[]
  const json = await res.json()
  return json.campaigns as any[]
}

export default async function CampaignsHome() {
  const campaigns = await fetchCampaigns()
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
          <Card key={c.id} className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-zinc-100">{c.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-400 line-clamp-3">{c.service_line}</p>
              <div className="mt-4 flex justify-end">
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


