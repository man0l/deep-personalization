"use client"
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

export default function EditCampaignPage() {
  const params = useParams<{ id: string }>()
  const id = (params?.id || '') as string
  const router = useRouter()

  const [name, setName] = useState('')
  const [serviceLine, setServiceLine] = useState('')
  const [summarizePrompt, setSummarizePrompt] = useState('')
  const [icebreakerPrompt, setIcebreakerPrompt] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    ;(async () => {
      const res = await fetch(`/api/campaigns/${id}`)
      const json = await res.json()
      if (res.ok) {
        const c = json.campaign
        setName(c.name || '')
        setServiceLine(c.service_line || '')
        setSummarizePrompt(c.summarize_prompt || '')
        setIcebreakerPrompt(c.icebreaker_prompt || '')
      }
    })()
  }, [id])

  async function save() {
    setSaving(true)
    const res = await fetch(`/api/campaigns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        service_line: serviceLine,
        summarize_prompt: summarizePrompt,
        icebreaker_prompt: icebreakerPrompt,
      }),
    })
    setSaving(false)
    if (res.ok) router.push(`/campaigns/${id}`)
  }

  return (
    <main className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold text-violet-300">Edit campaign</h1>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-zinc-400">Name</label>
          <Input value={name} onChange={(e)=>setName(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-zinc-400">Service line</label>
          <Textarea value={serviceLine} onChange={(e)=>setServiceLine(e.target.value)} rows={3} />
        </div>
        <div>
          <label className="text-xs text-zinc-400">Summarize prompt</label>
          <Textarea value={summarizePrompt} onChange={(e)=>setSummarizePrompt(e.target.value)} rows={6} />
        </div>
        <div>
          <label className="text-xs text-zinc-400">Icebreaker prompt</label>
          <Textarea value={icebreakerPrompt} onChange={(e)=>setIcebreakerPrompt(e.target.value)} rows={8} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={()=>router.back()} className="bg-zinc-900 border border-zinc-800">Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-violet-600 hover:bg-violet-500">{saving? 'Saving…' : 'Save changes'}</Button>
        </div>
      </div>
    </main>
  )
}


