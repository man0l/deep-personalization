import Link from 'next/link'

async function fetchCampaigns() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/campaigns`, { cache: 'no-store' })
  if (!res.ok) return [] as any[]
  const json = await res.json()
  return json.campaigns as any[]
}

export default async function CampaignsHome() {
  const campaigns = await fetchCampaigns()
  return (
    <main className="p-8 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Campaigns</h1>
        <Link href="/campaigns/new" className="underline">Create Campaign</Link>
      </div>
      <ul className="space-y-2">
        {campaigns.map((c) => (
          <li key={c.id} className="border p-3 rounded">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{c.name}</div>
                <div className="text-sm text-zinc-600">{c.service_line}</div>
              </div>
              <Link href={`/campaigns/${c.id}`} className="underline">Open</Link>
            </div>
          </li>
        ))}
        {campaigns.length === 0 && <li className="text-sm text-zinc-600">No campaigns yet.</li>}
      </ul>
    </main>
  )
}


