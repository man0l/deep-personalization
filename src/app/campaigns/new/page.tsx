"use client"
import { useState } from 'react'

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
      alert(json.error || 'Failed to upload')
      return
    }
    setInserted(json.inserted)
  }

  return (
    <main className="p-8 space-y-6">
      <h1 className="text-2xl font-semibold">New Campaign</h1>
      <div className="space-x-2">
        <button className={`underline ${step===1?'font-bold':''}`} onClick={()=>setStep(1)}>1. Details</button>
        <button className={`underline ${step===2?'font-bold':''}`} onClick={()=>setStep(2)} disabled={!name || !serviceLine}>2. Prompts</button>
        <button className={`underline ${step===3?'font-bold':''}`} onClick={()=>setStep(3)} disabled={!campaignId}>3. Upload CSV</button>
      </div>

      {step===1 && (
        <section className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Campaign name</label>
            <input className="border px-2 py-1 w-full" value={name} onChange={(e)=>setName(e.target.value)} placeholder="e.g., SEO Agencies - Oct" />
          </div>
          <div>
            <label className="block text-sm font-medium">Service line (used in icebreaker)</label>
            <textarea className="border px-2 py-1 w-full" rows={3} value={serviceLine} onChange={(e)=>setServiceLine(e.target.value)} placeholder="To make a long story short, ..." />
          </div>
          <button className="border px-3 py-1" disabled={!name || !serviceLine} onClick={()=>setStep(2)}>Continue</button>
        </section>
      )}

      {step===2 && (
        <section className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Summarize prompt</label>
            <textarea className="border px-2 py-1 w-full" rows={8} value={summarizePrompt} onChange={(e)=>setSummarizePrompt(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium">Icebreaker prompt</label>
            <textarea className="border px-2 py-1 w-full" rows={8} value={icePrompt} onChange={(e)=>setIcePrompt(e.target.value)} />
          </div>
          <button className="border px-3 py-1" disabled={saving} onClick={createCampaign}>Save Campaign</button>
        </section>
      )}

      {step===3 && (
        <section className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Upload CSV</label>
            <input type="file" accept=".csv" onChange={(e)=>setFile(e.target.files?.[0])} />
          </div>
          <button className="border px-3 py-1" disabled={!file || saving} onClick={uploadCsv}>Upload</button>
          {inserted !== undefined && <p className="text-sm">Inserted {inserted} rows.</p>}
        </section>
      )}
    </main>
  )
}


