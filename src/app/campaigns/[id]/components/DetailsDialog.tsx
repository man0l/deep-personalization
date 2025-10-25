"use client"
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Lead } from '../types'

export function DetailsDialog({
  open,
  onOpenChange,
  lead,
  statusDraft,
  setStatusDraft,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  lead: Lead | null
  statusDraft: string
  setStatusDraft: (v: string) => void
  onSaved: (leadId: string, newStatus: string) => void
}) {
  const [jobError, setJobError] = useState<string>('')

  useEffect(()=>{
    let cancelled = false
    if (!lead) return
    ;(async()=>{
      try {
        const r = await fetch(`/api/leads/${lead.id}/job`)
        const j = await r.json()
        if (!cancelled) setJobError(j.job?.error || '')
      } catch { if (!cancelled) setJobError('') }
    })()
    return ()=>{ cancelled = true }
  }, [lead?.id])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-950 border-zinc-800 max-w-3xl">
        <DialogHeader>
          <DialogTitle>Lead details</DialogTitle>
        </DialogHeader>
        {lead && (
          <div className="space-y-4">
            <div className="text-sm text-zinc-300">
              <div className="font-medium text-white">{lead.full_name || '(No name)'} • {lead.company_name || ''}</div>
              <div className="text-xs text-zinc-500">{lead.email || ''}</div>
            </div>
            <div>
              <label className="text-xs text-zinc-400">Status</label>
              <div className="mt-1">
                <select className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded" value={statusDraft} onChange={(e)=>setStatusDraft(e.target.value)}>
                  {['none','queued','processing','done','error'].map(s=> <option key={s} value={s}>{s}</option>)}
                </select>
                <Button className="ml-2 bg-violet-600 hover:bg-violet-500" onClick={async ()=>{
                  if (!lead) return
                  await fetch(`/api/leads/${lead.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ice_status: statusDraft }) })
                  onSaved(lead.id, statusDraft)
                }}>Save</Button>
              </div>
              {lead.ice_status === 'error' && jobError && (
                <div className="mt-3 text-sm">
                  <div className="text-xs text-red-300 mb-1">Last error</div>
                  <pre className="bg-zinc-900 border border-red-900/40 text-red-300 rounded p-2 whitespace-pre-wrap break-words">{jobError}</pre>
                </div>
              )}
            </div>
            <div>
              <label className="text-xs text-zinc-400">Ice breaker</label>
              <pre className="mt-1 max-h-96 overflow-auto whitespace-pre-wrap break-words bg-zinc-900 border border-zinc-800 rounded p-3 text-zinc-200">{lead.ice_breaker || '—'}</pre>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}


