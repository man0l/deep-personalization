"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function DuplicateCampaignButton({ id }: { id: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function onDuplicate() {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'duplicate' }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json?.campaign?.id) {
        // Redirect to upload CSV page right after duplication
        router.push(`/campaigns/${json.campaign.id}/upload`)
        return
      }
    } finally {
      setLoading(false)
    }
    // Fallback: refresh list
    router.refresh()
  }

  return (
    <Button onClick={onDuplicate} disabled={loading} variant="secondary" className="bg-zinc-800 text-zinc-200 hover:bg-zinc-700">
      {loading ? 'Duplicating…' : 'Duplicate'}
    </Button>
  )
}


