"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ColumnDef, flexRender, getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SelectionCheckbox, HeaderSelectionCheckbox, selectionStore } from './use-campaign-leads'
import type { Lead } from './types'
import { ViewMenu } from './components/ViewMenu'
import { PurgeQueuedDialog } from './components/PurgeQueuedDialog'
import { DetailsDialog } from './components/DetailsDialog'
import { PaginationBar } from './components/PaginationBar'
import { BulkActionsBar } from './components/BulkActionsBar'
import { FilterBuilder, type FilterSpec } from './components/FilterBuilder'

 

export default function CampaignDetail() {
  const params = useParams<{ id: string }>()
  const id = (params?.id || '') as string
  const [data, setData] = useState<Lead[]>([])
  const [total, setTotal] = useState(0)
  const [totals, setTotals] = useState<Record<string, number>>({})
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [q, setQ] = useState('')
  const [hasIce, setHasIce] = useState<'all'|'true'|'false'>('all')
 
  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>(()=>{
    return {
      select: true, full_name: true, title: true, company_name: true, company_website: true, email: true,
      industry: true, city: true, state: true, country: true, ice_status: true, actions: true,
    }
  })
  useEffect(()=>{ try { localStorage.setItem(`view:${id}:visibleCols`, JSON.stringify(visibleCols)) } catch{} }, [id, visibleCols])
  const [filters, setFilters] = useState({ full_name: '', title: '', company_name: '', email: '' })
  const [filterSpecs, setFilterSpecs] = useState<FilterSpec[]>([])
  const [sortBy, setSortBy] = useState<string>('created_at')
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc')
  // Removed header-level select-all controls; keep only per-row selection
  const [mounted, setMounted] = useState(false)
  useEffect(()=>{ setMounted(true) }, [])

  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsLead, setDetailsLead] = useState<Lead | null>(null)
  const [statusDraft, setStatusDraft] = useState<string>('none')
  const [density, setDensity] = useState<'comfortable'|'compact'>(()=> 'comfortable')
  useEffect(()=>{ try { localStorage.setItem(`view:${id}:density`, density) } catch{} }, [id, density])
  const [statusFilter, setStatusFilter] = useState<'queued'|'processing'|'error'|null>(null)
  const [loading, setLoading] = useState(false)
  const [pollUntil, setPollUntil] = useState<number>(0)
  const [enriching, setEnriching] = useState(false)
  const [purging, setPurging] = useState(false)

  // After mount, hydrate preferences from localStorage to avoid SSR/client mismatch
  useEffect(()=>{
    if (!mounted) return
    try {
      const v = localStorage.getItem(`view:${id}:visibleCols`)
      if (v) setVisibleCols((base)=> ({ ...base, ...JSON.parse(v) }))
    } catch {}
    try {
      const d = localStorage.getItem(`view:${id}:density`) as any
      if (d === 'comfortable' || d === 'compact') setDensity(d)
    } catch {}
  }, [mounted, id])

  const load = useCallback(async () => {
    if (loading) return
    setLoading(true)
    const paramsQ = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    const shouldIncludeTotals = Date.now() > pollUntil
    if (shouldIncludeTotals) paramsQ.set('includeTotals', '1')
    if (q) paramsQ.set('q', q)
    if (statusFilter) {
      paramsQ.set('status', statusFilter)
    } else {
      if (hasIce !== 'all') paramsQ.set('hasIce', hasIce)
    }
    // Compile FilterBuilder specs
    const statusSpec = filterSpecs.find(f=> f.field==='status') as any
    if (statusSpec && Array.isArray(statusSpec.values) && statusSpec.values.length>0) {
      // If op is 'any' and a single value is chosen we can map to status=; otherwise rely on hasIce or future API expansion
      if (statusSpec.values.length===1 && statusSpec.op==='any') {
        paramsQ.set('status', statusSpec.values[0])
      } else if (statusSpec.op==='any' && statusSpec.values.includes('done') && !statusSpec.values.some((v:string)=> v!=='done')) {
        paramsQ.set('hasIce','true')
      } else if (statusSpec.op==='none' && statusSpec.values.includes('done') && statusSpec.values.length===1) {
        paramsQ.set('hasIce','false')
      }
    }
    const textMap: any = { full_name: 'f_full_name', title: 'f_title', company_name: 'f_company_name', email: 'f_email' }
    for (const ts of filterSpecs) {
      if (ts.field==='company_website') {
        const ws: any = ts as any
        if (ws.op === 'like' && ws.value) paramsQ.set('f_company_website_like', ws.value)
        if (ws.op === 'empty') paramsQ.set('f_company_website_empty', '1')
        if (ws.op === 'not_empty') paramsQ.set('f_company_website_not_empty', '1')
        continue
      }
      if ((ts as any).field === 'email_like') {
        const es: any = ts as any
        if (es.op === 'like' && es.value) paramsQ.set('f_email_like', es.value)
        if (es.op === 'empty') paramsQ.set('f_email_empty', '1')
        if (es.op === 'not_empty') paramsQ.set('f_email_not_empty', '1')
        continue
      }
      if (ts.field!=='status' && (ts as any).value) paramsQ.set(textMap[ts.field], (ts as any).value)
    }
    if (sortBy) paramsQ.set('sortBy', sortBy)
    if (sortDir) paramsQ.set('sortDir', sortDir)
    const res = await fetch(`/api/campaigns/${id}/leads?` + paramsQ.toString(), { cache: 'no-store' })
    let json: any = null
    try {
      const txt = await res.text()
      json = txt ? JSON.parse(txt) : null
    } catch {}
    if (res.ok && json) {
      setData(json.leads)
      setTotal(json.total)
      if (json.totals) setTotals(json.totals)
    } else if (!res.ok) {
      // best-effort fallback to keep UI responsive
      setData([])
      setTotal(0)
    }
    setLoading(false)
  }, [page, pageSize, pollUntil, q, statusFilter, hasIce, filters.full_name, filters.title, filters.company_name, filters.email, sortBy, sortDir, id, filterSpecs])

  useEffect(() => { load() }, [load])

  // Clear selection when query inputs change (but not on polling refreshes)
  useEffect(()=>{
    selectionStore.clear()
  }, [page, pageSize, q, hasIce, statusFilter, filters.full_name, filters.title, filters.company_name, filters.email, sortBy, sortDir, id, filterSpecs])

  // Kick off a short polling window on mount (~25s)
  useEffect(()=>{
    if (!mounted) return
    setPollUntil(Date.now() + 25000)
  }, [mounted])

  // Poll while within the window
  useEffect(()=>{
    if (pollUntil <= Date.now()) return
    const h = setInterval(()=>{
      if (Date.now() <= pollUntil) load()
    }, 2000)
    return ()=> clearInterval(h)
  }, [pollUntil, load])

  // Removed selectVisiblePageRows (header checkbox)
  // Removed selectAllFiltered (Select all button)

  function buildSortHeader(label: string, key: string) {
    const active = sortBy === key
    const indicator = active ? (sortDir === 'asc' ? '▲' : '▼') : ''
    return (
      <button
        className={`inline-flex items-center gap-1 ${active? 'text-violet-300':'text-zinc-300'}`}
        onClick={()=>{
          if (sortBy !== key) { setSortBy(key); setSortDir('asc') }
          else { setSortDir(sortDir === 'asc' ? 'desc' : 'asc') }
          setPage(1)
        }}
      >
        <span>{label}</span>
        {indicator && <span aria-hidden>{indicator}</span>}
      </button>
    )
  }

  const columns = useMemo<ColumnDef<Lead>[]>(() => [
    visibleCols.select ? { header: (
      <div className="flex items-center gap-2">
        <HeaderSelectionCheckbox ids={data.map(l=> l.id)} disabled={loading} />
      </div>
    ), id: 'select', cell: ({ row }: any) => {
      const id = row.original.id as string
      return <SelectionCheckbox id={id} />
    } } : undefined,
    visibleCols.full_name ? { header: () => buildSortHeader('Name','full_name'), accessorKey: 'full_name' } : undefined,
    visibleCols.title ? { header: () => buildSortHeader('Title','title'), accessorKey: 'title' } : undefined,
    visibleCols.company_name ? { header: () => buildSortHeader('Company','company_name'), accessorKey: 'company_name' } : undefined,
    visibleCols.company_website ? { header: () => buildSortHeader('Website','company_website'), accessorKey: 'company_website' } : undefined,
    visibleCols.email ? { header: () => buildSortHeader('Email','email'), accessorKey: 'email' } : undefined,
    visibleCols.industry ? { header: () => buildSortHeader('Industry','industry'), accessorKey: 'industry' } : undefined,
    visibleCols.city ? { header: () => buildSortHeader('City','city'), accessorKey: 'city' } : undefined,
    visibleCols.state ? { header: () => buildSortHeader('State','state'), accessorKey: 'state' } : undefined,
    visibleCols.country ? { header: () => buildSortHeader('Country','country'), accessorKey: 'country' } : undefined,
    visibleCols.ice_status ? { header: () => buildSortHeader('Ice','ice_status'), accessorKey: 'ice_status' } : undefined,
    { header: () => buildSortHeader('Enriched','enriched_at'), accessorKey: 'enriched_at', cell: ({ row }: any) => {
      const v = row.original.enriched_at
      return <span className="text-zinc-400">{v ? new Date(v).toLocaleString() : '—'}</span>
    } },
    visibleCols.actions ? { header: 'Actions', id: 'actions', cell: ({ row }: any) => (
      <div className="flex gap-2">
        <button className="underline" onClick={async ()=>{ const lead = row.original as Lead; setDetailsLead(lead); setStatusDraft(lead.ice_status); setDetailsOpen(true) }}>Details</button>
      </div>
    ) } : undefined,
  ].filter(Boolean) as ColumnDef<Lead>[], [visibleCols, sortBy, sortDir, data])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  // Selection logic removed

  // Per-checkbox external store removed for simplicity

  // selectedIds replaced with selectedCount + getSelectedIds for cheaper renders

  async function enrich(ids: string[]) {
    if (ids.length === 0 || enriching) return
    setEnriching(true)
    try {
      const unique = Array.from(new Set(ids))
      const chunkSize = 50
      for (let i = 0; i < unique.length; i += chunkSize) {
        const chunk = unique.slice(i, i + chunkSize)
        await fetch('/api/leads/enrich', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadIds: chunk }) })
        setPollUntil(Date.now() + 30000)
      }
      await load()
    } finally {
      setEnriching(false)
    }
  }

  async function enrichAllMissing() {
    const missing = data.filter(l=>l.ice_status !== 'done').map(l=>l.id)
    await enrich(missing)
  }

  async function purgeQueued() {
    if (purging) return
    setPurging(true)
    try {
      await fetch(`/api/campaigns/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'purge_queued' }) })
      await load()
    } finally {
      setPurging(false)
    }
  }

  // Views: sticky first N columns + wide table for smooth horizontal scroll
  const colWidths = [40, 220, 230, 300, 240, 260, 260, 180, 160, 170, 120, 160, 180]
  const totalWidth = colWidths.reduce((a,b)=>a+b,0)
  const [frozenCount, setFrozenCount] = useState<number>(()=> 2)
  useEffect(()=>{ try { localStorage.setItem(`view:${id}:frozenCount`, String(frozenCount)) } catch{} }, [id, frozenCount])
  useEffect(()=>{
    if (!mounted) return
    try { const v = localStorage.getItem(`view:${id}:frozenCount`); if (v) setFrozenCount(Number(v)) } catch {}
  }, [mounted, id])
  const leftOf = (i:number) => colWidths.slice(0,i).reduce((a,b)=>a+b,0)
  // Scroll container ref to sync horizontal scroll with footer proxy scrollbar
  const tableScrollRef = useRef<HTMLDivElement | null>(null)

  return (
    <main className="space-y-4">
      <div>
        <Button asChild variant="secondary" className="bg-zinc-900 border border-zinc-800">
          <Link href="/campaigns">← Back to Campaigns</Link>
        </Button>
      </div>
      <div className="text-sm text-zinc-400 flex gap-4">
        <button
          className="hover:text-violet-300"
          onClick={()=>{
            setStatusFilter(null)
            setHasIce('all')
            setQ('')
            setFilters({ full_name:'', title:'', company_name:'', email:'' })
            setPage(1)
          }}
        >
          Total: {totals.total ?? 0}
        </button>
        <button className={`hover:text-violet-300 ${(!statusFilter && hasIce==='true')?'text-violet-300':''}`} onClick={()=>{ setStatusFilter(null); setHasIce('true'); setPage(1) }}>Done: {totals.done ?? 0}</button>
        <button className={`hover:text-violet-300 ${statusFilter==='queued'?'text-violet-300':''}`} onClick={()=>{ setStatusFilter('queued'); setHasIce('all'); setPage(1) }}>Queued: {totals.queued ?? 0}</button>
        <button className={`hover:text-violet-300 ${statusFilter==='processing'?'text-violet-300':''}`} onClick={()=>{ setStatusFilter('processing'); setHasIce('all'); setQ(''); setFilters({ full_name:'', title:'', company_name:'', email:'' }); setPage(1) }}>Processing: {totals.processing ?? 0}</button>
        <button className={`hover:text-violet-300 ${statusFilter==='error'?'text-violet-300':''}`} onClick={()=>{ setStatusFilter('error'); setHasIce('all'); setPage(1) }}>Error: {totals.error ?? 0}</button>
      </div>
      <div className="flex items-center gap-4">
        <Input placeholder="Search" value={q} onChange={(e)=>setQ(e.target.value)} onKeyDown={(e)=>{ if (e.key==='Enter') { setPage(1) } }} />
        <Button onClick={enrichAllMissing} disabled={enriching} variant="secondary" className="bg-violet-700/30 text-violet-300 hover:bg-violet-700/50">Enrich All Missing (page)</Button>
        <FilterBuilder value={filterSpecs} onChange={(v)=>{ setFilterSpecs(v); setPage(1) }} />
        <ViewMenu
          density={density}
          setDensity={setDensity}
          visibleCols={visibleCols}
          setVisibleCols={(u)=> setVisibleCols(u)}
        />
        <PurgeQueuedDialog onConfirm={purgeQueued} disabled={purging} />
        
      </div>
      {/* Bulk actions */}
      <BulkActionsBar
        visibleIds={useMemo(()=> data.map(l=> l.id), [data])}
        onAfterAction={() => { setPollUntil(Date.now() + 30000); load() }}
        hideWhenEmpty
      />

      <div ref={tableScrollRef} className="overflow-x-auto hide-x-scrollbar border border-zinc-800 rounded">
        <table className={`w-full text-sm`} style={{ minWidth: totalWidth }}>
          <thead>
            {table.getHeaderGroups().map(hg=> (
              <tr key={hg.id} className="bg-zinc-900 sticky top-0 z-30">
                {hg.headers.map((h, i)=> {
                  const isFrozen = mounted && i < frozenCount
                  const headPad = density==='compact'? 'py-1 px-2' : 'p-2'
                  return (
                    <th
                      key={h.id}
                      className={`text-left ${headPad} border-b border-zinc-800 ${isFrozen ? 'sticky z-20 bg-zinc-900' : ''}`}
                      style={{ left: isFrozen ? leftOf(i) : undefined, width: colWidths[i] }}
                    >
                      {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(r=> (
              <tr key={r.id} className="odd:bg-zinc-900">
                {r.getVisibleCells().map((c, i)=> {
                  const isFrozen = mounted && i < frozenCount
                  const cellPad = density==='compact'? 'py-1 px-2' : 'p-2'
                  return (
                    <td
                      key={c.id}
                      className={`${cellPad} border-b border-zinc-800 ${isFrozen ? 'sticky z-10 bg-zinc-950' : ''}`}
                      style={{ left: isFrozen ? leftOf(i) : undefined, width: colWidths[i] }}
                    >
                      {flexRender(c.column.columnDef.cell, c.getContext())}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Details Dialog */}
      <DetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        lead={detailsLead}
        statusDraft={statusDraft}
        setStatusDraft={setStatusDraft}
        onSaved={(leadId, newStatus)=> setData(d=> d.map(l=> l.id===leadId? { ...l, ice_status: newStatus }: l))}
      />

      <PaginationBar
        page={page}
        setPage={setPage as any}
        pageSize={pageSize}
        setPageSize={(n)=> setPageSize(n)}
        total={total}
        frozenCount={frozenCount}
        setFrozenCount={setFrozenCount}
        scrollTargetRef={tableScrollRef}
      />
    </main>
  )
}

 


