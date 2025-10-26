"use client"
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function UploadCampaignCsvPage() {
  const params = useParams<{ id: string }>()
  const id = (params?.id || '') as string
  const router = useRouter()
  const [file, setFile] = useState<File | undefined>()
  const [saving, setSaving] = useState(false)
  const [inserted, setInserted] = useState<number | undefined>()

  async function uploadCsv() {
    if (!id || !file) return
    setSaving(true)
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`/api/campaigns/${id}/upload`, { method: 'POST', body: form })
    const json = await res.json().catch(()=>({}))
    setSaving(false)
    if (!res.ok) {
      toast.error(json?.error || 'Failed to upload')
      return
    }
    setInserted(json.inserted)
    toast.success(`Imported ${json.inserted} leads`, { description: 'Opening campaign…' })
    setTimeout(()=> router.push(`/campaigns/${id}`), 500)
  }

  return (
    <main className="space-y-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold text-violet-300">Upload CSV</h1>
      <p className="text-sm text-zinc-400">Choose a CSV with your leads for this campaign.</p>
      <div>
        <input type="file" accept=".csv" onChange={(e)=> setFile(e.target.files?.[0])} />
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" className="bg-zinc-900 border border-zinc-800" onClick={()=>router.back()}>Cancel</Button>
        <Button onClick={uploadCsv} disabled={!file || saving} className="bg-violet-600 hover:bg-violet-500">{saving? 'Uploading…' : 'Upload'}</Button>
      </div>
      {inserted !== undefined && <p className="text-sm text-zinc-400">Inserted {inserted} rows.</p>}
    </main>
  )
}


