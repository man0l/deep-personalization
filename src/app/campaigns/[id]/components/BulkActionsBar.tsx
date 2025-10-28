"use client"
import React, { useMemo, useSyncExternalStore, useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Sparkles, Trash2, X, ShieldCheck, Filter as FilterIcon, Download } from 'lucide-react'
import { selectionStore } from '../use-campaign-leads'

export function BulkActionsBar({
  visibleIds,
  onAfterAction,
  hideWhenEmpty,
  campaignId,
  exportQuery,
}: {
  visibleIds: string[]
  onAfterAction: () => void
  hideWhenEmpty?: boolean
  campaignId: string
  exportQuery: string
}) {
  const selectedCount = useSyncExternalStore(
    (l)=> selectionStore.subscribeAll(l),
    () => selectionStore.getSelectedIds().length,
    () => 0
  )

  const [busy, setBusy] = useState(false)
  const someVisibleChecked = useMemo(()=> visibleIds.some(id=> selectionStore.isSelected(id)), [visibleIds, selectedCount])

  async function doEnrich(ids: string[]) {
    if (ids.length===0) return
    await fetch('/api/leads/enrich', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadIds: ids }) })
  }
  async function doStatus(ids: string[], status: string) {
    if (ids.length===0) return
    await fetch('/api/leads/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'status', ids, status }) })
  }
  async function doDelete(ids: string[]) {
    if (ids.length===0) return
    await fetch('/api/leads/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', ids }) })
  }

  const onCheckVisible = () => selectionStore.setMany(visibleIds, true)
  const onUncheckVisible = () => selectionStore.setMany(visibleIds, false)
  const onClear = () => selectionStore.clear()

  async function run(action: () => Promise<any>) {
    if (busy) return
    setBusy(true)
    try {
      await action()
      onAfterAction()
    } finally {
      setBusy(false)
    }
  }

  const allSelectedIds = useMemo(()=> selectionStore.getSelectedIds(), [selectedCount])

  function download(url: string) {
    if (typeof window !== 'undefined') window.open(url, '_blank')
  }

  function extractErrorMessage(payload: any, rawText: string): string {
    let code: string | number | undefined
    let message: string | undefined
    let err: any = (payload && payload.error !== undefined) ? payload.error : payload
    if (typeof err === 'string') {
      try {
        const obj = JSON.parse(err)
        code = obj?.statusCode || obj?.code
        message = obj?.message
      } catch {
        message = err
      }
    } else if (err && typeof err === 'object') {
      code = err.statusCode || err.code
      message = err.message
    }
    if (!message && typeof payload?.message === 'string') message = payload.message
    if (!code && (payload?.statusCode || payload?.code)) code = payload.statusCode || payload.code
    const base = message || rawText || 'Verification failed'
    return code ? `${code}: ${base}` : base
  }

  async function verifySelected() {
    const ids = allSelectedIds
    if (ids.length===0) return
    await run(async ()=>{
      const res = await fetch('/api/leads/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, campaignId }) })
      let payload: any = null
      let raw = ''
      try { raw = await res.text(); payload = raw ? JSON.parse(raw) : null } catch {}
      if (!res.ok || payload?.error) {
        const msg = extractErrorMessage(payload, raw)
        toast.error(msg)
        return
      }
      toast.success('Verification queued', { description: `File ${payload?.fileId || ''}`.trim() })
    })
  }

  async function verifyAllFiltered() {
    const url = `/api/campaigns/${campaignId}/leads/verify-all?${exportQuery}`
    await run(async ()=>{
      const res = await fetch(url, { method: 'POST' })
      let payload: any = null
      let raw = ''
      try { raw = await res.text(); payload = raw ? JSON.parse(raw) : null } catch {}
      if (!res.ok || payload?.error) {
        const msg = extractErrorMessage(payload, raw)
        toast.error(msg)
        return
      }
      toast.success('Verification queued', { description: `${payload?.scanned ?? 0} emails • File ${payload?.fileId || ''}`.trim() })
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2 bg-zinc-900/60 border border-zinc-800 rounded px-2 py-2">
      <span className="text-xs text-zinc-400">Selected: {selectedCount}</span>
      <div className="w-px h-5 bg-zinc-800 mx-1" />
      {/* Selection-based actions */}
      <Button variant="secondary" className="bg-violet-700/30 text-violet-300 border border-violet-800/50 hover:bg-violet-700/50" disabled={busy || allSelectedIds.length===0} onClick={()=> run(()=> doEnrich(allSelectedIds))}>
        <Sparkles className="mr-1 h-4 w-4" /> Enrich
      </Button>
      <select className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded" disabled={busy || allSelectedIds.length===0} onChange={(e)=>{
        const v = e.target.value
        if (!v) return
        run(()=> doStatus(allSelectedIds, v))
        e.currentTarget.selectedIndex = 0
      }}>
        <option value="">Set status…</option>
        {['none','queued','processing','done','error'].map(s=> <option key={s} value={s}>{s}</option>)}
      </select>
      <Button variant="secondary" className="bg-red-900/20 text-red-300 border border-red-900/40 hover:bg-red-900/30" disabled={busy || allSelectedIds.length===0} onClick={()=> run(()=> doDelete(allSelectedIds))}>
        <Trash2 className="mr-1 h-4 w-4" /> Delete
      </Button>
      <Button variant="secondary" className="bg-zinc-900 border border-zinc-800" onClick={onClear} disabled={selectedCount===0}>
        <X className="mr-1 h-4 w-4" /> Clear selection
      </Button>

      <div className="w-px h-5 bg-zinc-800 mx-2" />
      {/* Verify actions */}
      <Button
        variant="secondary"
        className="bg-zinc-900 border border-zinc-800"
        disabled={allSelectedIds.length===0}
        onClick={verifySelected}
      >
        <ShieldCheck className="mr-1 h-4 w-4" /> Verify selected
      </Button>
      <Button
        variant="secondary"
        className="bg-zinc-900 border border-zinc-800"
        onClick={verifyAllFiltered}
      >
        <FilterIcon className="mr-1 h-4 w-4" /> Verify all (filtered)
      </Button>
      <div className="w-px h-5 bg-zinc-800 mx-2" />
      {/* Export actions */}
      <Button
        variant="secondary"
        className="bg-zinc-900 border border-zinc-800"
        disabled={allSelectedIds.length===0}
        onClick={() => {
          const url = `/api/campaigns/${campaignId}/leads/export?${exportQuery}` + (allSelectedIds.length>0? `&ids=${encodeURIComponent(allSelectedIds.join(','))}`:'')
          download(url)
        }}
      >
        <Download className="mr-1 h-4 w-4" /> Export selected (CSV)
      </Button>
      <Button
        variant="secondary"
        className="bg-zinc-900 border border-zinc-800"
        onClick={() => {
          const url = `/api/campaigns/${campaignId}/leads/export?${exportQuery}`
          download(url)
        }}
      >
        <Download className="mr-1 h-4 w-4" /> Export all (CSV)
      </Button>
    </div>
  )
}


