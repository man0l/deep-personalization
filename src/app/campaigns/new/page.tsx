"use client"
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export default function NewCampaignPage() {
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [serviceLine, setServiceLine] = useState('')
  const [summarizePrompt, setSummarizePrompt] = useState('You are summarizing a company\'s page for sales research. Write a tight 3–5 bullet summary.\nPage URL: {url}\nContent (markdown):\n{markdown}')
  const [icePrompt, setIcePrompt] = useState('Write a 2–3 paragraph, personable cold open for {firstName} at {companyName}.\nUse insights from these page summaries:\n{pageSummaries}\nInclude this service line: {serviceLine}\nTone: curious, succinct, no fluff. No subject line. Output only the message.')
  const [campaignId, setCampaignId] = useState<string|undefined>()
  const [file, setFile] = useState<File|undefined>()
  const [saving, setSaving] = useState(false)
  const [inserted, setInserted] = useState<number|undefined>()
  const router = useRouter()

  async function createCampaign() {
    setSaving(true)
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, service_line: serviceLine, summarize_prompt: summarizePrompt, icebreaker_prompt: icePrompt }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) {
      alert(json.error || 'Failed to create campaign')
      return
    }
    setCampaignId(json.campaign.id)
    setStep(3)
  }

  async function uploadCsv() {
    if (!campaignId || !file) return
    setSaving(true)
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`/api/campaigns/${campaignId}/upload`, { method: 'POST', body: form })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) {
      toast.error(json.error || 'Failed to upload')
      return
    }
    setInserted(json.inserted)
    toast.success(`Imported ${json.inserted} leads`, { description: 'Open the campaign to see your leads' })
    setTimeout(()=> router.push(`/campaigns/${campaignId}`), 600)
  }

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold text-violet-300">New Campaign</h1>
      <div className="space-x-2">
        <button className={`underline ${step===1?'text-violet-300':'text-zinc-400'}`} onClick={()=>setStep(1)}>1. Details</button>
        <button className={`underline ${step===2?'text-violet-300':'text-zinc-400'}`} onClick={()=>setStep(2)} disabled={!name || !serviceLine}>2. Prompts</button>
        <button className={`underline ${step===3?'text-violet-300':'text-zinc-400'}`} onClick={()=>setStep(3)} disabled={!campaignId}>3. Upload CSV</button>
      </div>

      {step===1 && (
        <section className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300">Campaign name</label>
            <Input value={name} onChange={(e)=>setName(e.target.value)} placeholder="e.g., SEO Agencies - Oct" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300">Service line (used in icebreaker)</label>
            <Textarea rows={3} value={serviceLine} onChange={(e)=>setServiceLine(e.target.value)} placeholder="To make a long story short, ..." />
          </div>
          <Button disabled={!name || !serviceLine} onClick={()=>setStep(2)} className="bg-violet-600 hover:bg-violet-500">Continue</Button>
        </section>
      )}

      {step===2 && (
        <section className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300">Summarize prompt</label>
            <Textarea rows={8} value={summarizePrompt} onChange={(e)=>setSummarizePrompt(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300">Icebreaker prompt</label>
            <Textarea rows={8} value={icePrompt} onChange={(e)=>setIcePrompt(e.target.value)} />
          </div>
          <Button disabled={saving} onClick={createCampaign} className="bg-violet-600 hover:bg-violet-500">Save Campaign</Button>
        </section>
      )}

      {step===3 && (
        <section className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300">Upload CSV</label>
            <input type="file" accept=".csv" onChange={(e)=>setFile(e.target.files?.[0])} />
          </div>
          <Button disabled={!file || saving} onClick={uploadCsv} className="bg-violet-600 hover:bg-violet-500">Upload</Button>
          {inserted !== undefined && <p className="text-sm text-zinc-400">Inserted {inserted} rows.</p>}
        </section>
      )}
    </main>
  )
}


