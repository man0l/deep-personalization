"use client"
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useParams } from 'next/navigation'
import { ColumnDef, flexRender, getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

type Lead = {
  id: string
  first_name: string | null
  last_name: string | null
  full_name: string | null
  company_name: string | null
  company_website: string | null
  email: string | null
  title: string | null
  industry: string | null
  city: string | null
  state: string | null
  country: string | null
  ice_breaker: string | null
  ice_status: string
  enriched_at?: string | null
}

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
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>(()=>{
    return {
      select: true, full_name: true, title: true, company_name: true, company_website: true, email: true,
      industry: true, city: true, state: true, country: true, ice_status: true, actions: true,
    }
  })
  useEffect(()=>{ try { localStorage.setItem(`view:${id}:visibleCols`, JSON.stringify(visibleCols)) } catch{} }, [id, visibleCols])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState({ full_name: '', title: '', company_name: '', email: '' })
  const [sortBy, setSortBy] = useState<string>('created_at')
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc')
  const [selectAllBusy, setSelectAllBusy] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(()=>{ setMounted(true) }, [])

  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsLead, setDetailsLead] = useState<Lead | null>(null)
  const [statusDraft, setStatusDraft] = useState<string>('none')
  const [jobError, setJobError] = useState<string>('')
  const [density, setDensity] = useState<'comfortable'|'compact'>(()=> 'comfortable')
  useEffect(()=>{ try { localStorage.setItem(`view:${id}:density`, density) } catch{} }, [id, density])
  const [statusFilter, setStatusFilter] = useState<'queued'|'processing'|'error'|null>(null)
  const [loading, setLoading] = useState(false)
  const [pollUntil, setPollUntil] = useState<number>(0)
  const [enriching, setEnriching] = useState(false)
  const [purging, setPurging] = useState(false)
  const [isPending, startTransition] = useTransition()

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

  async function load() {
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
    if (filters.full_name) paramsQ.set('f_full_name', filters.full_name)
    if (filters.title) paramsQ.set('f_title', filters.title)
    if (filters.company_name) paramsQ.set('f_company_name', filters.company_name)
    if (filters.email) paramsQ.set('f_email', filters.email)
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
      setSelected({})
    } else if (!res.ok) {
      // best-effort fallback to keep UI responsive
      setData([])
      setTotal(0)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [page, pageSize, hasIce, statusFilter, q, sortBy, sortDir, filters.full_name, filters.title, filters.company_name, filters.email])

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
  }, [pollUntil])

  async function selectVisiblePageRows(flag: boolean) {
    const rows = table.getRowModel().rows
    const next: Record<string, boolean> = { ...selected }
    let changed = false
    for (const r of rows) {
      const id = (r.original as any).id
      const cur = !!next[id]
      if (cur !== flag) {
        changed = true
        if (flag) next[id] = true
        else delete next[id]
      }
    }
    if (!changed) return
    requestAnimationFrame(() => {
      startTransition(() => setSelected(next))
    })
  }
  async function selectAllFiltered() {
    if (selectAllBusy) return
    setSelectAllBusy(true)
    const paramsQ = new URLSearchParams({ page: '1', pageSize: '200', idsOnly: 'true' })
    if (q) paramsQ.set('q', q)
    if (hasIce !== 'all') paramsQ.set('hasIce', hasIce)
    if (filters.full_name) paramsQ.set('f_full_name', filters.full_name)
    if (filters.title) paramsQ.set('f_title', filters.title)
    if (filters.company_name) paramsQ.set('f_company_name', filters.company_name)
    if (filters.email) paramsQ.set('f_email', filters.email)
    // fetch ids in chunks of 200 until exhaustion
    const acc: string[] = []
    let pageIdx = 1
    while (true) {
      paramsQ.set('page', String(pageIdx))
      const res = await fetch(`/api/campaigns/${id}/leads?` + paramsQ.toString(), { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) break
      acc.push(...(json.ids || []))
      if (!json.ids || json.ids.length < 200) break
      pageIdx += 1
    }
    const newSel: Record<string, boolean> = { ...selected }
    acc.forEach((i)=> newSel[i] = true)
    startTransition(()=> setSelected(newSel))
    setSelectAllBusy(false)
  }

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
          setTimeout(()=>load(), 0)
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
        <input type="checkbox" onChange={(e)=> selectVisiblePageRows(e.target.checked)} />
        <Button variant="secondary" className="h-6 px-2 bg-zinc-900 border border-zinc-800" onClick={selectAllFiltered} disabled={selectAllBusy}>{selectAllBusy? 'Selecting…' : 'Select all'}</Button>
      </div>
    ), id: 'select', cell: ({ row }: any) => (
      <input type="checkbox" data-id={row.original.id} checked={!!selected[row.original.id]} onChange={onRowToggle} />
    ) } : undefined,
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
        <button className="underline" onClick={()=>enrich([row.original.id])}>Enrich</button>
        <button className="underline" onClick={async ()=>{ await fetch(`/api/leads/${row.original.id}`, { method: 'DELETE' }); await load() }}>Delete</button>
        <button className="underline" onClick={async ()=>{ const lead = row.original as Lead; setDetailsLead(lead); setStatusDraft(lead.ice_status); setDetailsOpen(true); try { const r = await fetch(`/api/leads/${lead.id}/job`); const j = await r.json(); setJobError(j.job?.error || '') } catch { setJobError('') } }}>Details</button>
      </div>
    ) } : undefined,
  ].filter(Boolean) as ColumnDef<Lead>[], [selected, visibleCols, sortBy, sortDir])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const toggleSelected = useCallback((id: string, checked: boolean) => {
    startTransition(()=>{
      setSelected(prev => {
        const isChecked = !!(prev as Record<string, boolean>)[id]
        if (isChecked === checked) return prev
        const next = { ...prev }
        if (checked) (next as Record<string, boolean>)[id] = true
        else delete (next as Record<string, boolean>)[id]
        return next
      })
    })
  }, [])

  const onRowToggle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const id = (e.currentTarget.dataset.id as string) || ''
    const checked = e.currentTarget.checked
    if (!id) return
    toggleSelected(id, checked)
  }, [toggleSelected])

  // Keep a ref to selected so cells can read latest state without forcing columns recreation
  const selectedRef = useRef<Record<string, boolean>>({})
  useEffect(()=>{ selectedRef.current = selected }, [selected])

  // Fast count for UI; compute full list only when needed
  const selectedCount = useMemo(()=> Object.keys(selected).length, [selected])
  const getSelectedIds = useCallback(()=> Object.keys(selectedRef.current), [])

  const selectedIds = useMemo(()=> Object.entries(selected).filter(([,v])=>v).map(([k])=>k), [selected])

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

  return (
    <main className="space-y-4">
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
        <Input placeholder="Search" value={q} onChange={(e)=>setQ(e.target.value)} onKeyDown={(e)=>{ if (e.key==='Enter') { setPage(1); load() } }} />
        <Button onClick={()=>enrich(selectedIds)} disabled={selectedIds.length===0 || enriching} className="bg-violet-600 hover:bg-violet-500">{enriching? 'Enriching…' : 'Enrich Selected'}</Button>
        <Button onClick={enrichAllMissing} disabled={enriching} variant="secondary" className="bg-violet-700/30 text-violet-300 hover:bg-violet-700/50">Enrich All Missing (page)</Button>
        <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
          <DialogTrigger asChild>
            <Button variant="secondary" className={`bg-zinc-900 border ${ (filters.full_name||filters.title||filters.company_name||filters.email||statusFilter||hasIce!=='all')? 'border-violet-700 text-violet-300':'border-zinc-800'}`}>Filters</Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-950 border-zinc-800">
            <DialogHeader>
              <DialogTitle>Filters</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-zinc-400">Name</label>
                <Input value={filters.full_name} onChange={e=>setFilters({ ...filters, full_name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-zinc-400">Title</label>
                <Input value={filters.title} onChange={e=>setFilters({ ...filters, title: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-zinc-400">Company</label>
                <Input value={filters.company_name} onChange={e=>setFilters({ ...filters, company_name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-zinc-400">Email</label>
                <Input value={filters.email} onChange={e=>setFilters({ ...filters, email: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6 mt-4">
              <div>
                <div className="text-xs text-zinc-400 mb-2">Status</div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { k: null as any, label: 'All' },
                    { k: 'done' as const, label: 'Done' },
                    { k: 'queued' as const, label: 'Queued' },
                    { k: 'processing' as const, label: 'Processing' },
                    { k: 'error' as const, label: 'Error' },
                  ].map(s=> (
                    <button
                      key={String(s.k)}
                      className={`px-2 py-1 rounded border ${statusFilter===s.k ? 'border-violet-700 bg-violet-700/20 text-violet-300' : 'border-zinc-800 bg-zinc-900 text-zinc-300'}`}
                      onClick={()=> setStatusFilter(s.k as any)}
                    >{s.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs text-zinc-400 mb-2">Has ice breaker</div>
                <div className="flex gap-2">
                  {[
                    { v: 'all' as const, label: 'All' },
                    { v: 'true' as const, label: 'Has' },
                    { v: 'false' as const, label: 'None' },
                  ].map(o=> (
                    <button
                      key={o.v}
                      className={`px-2 py-1 rounded border ${hasIce===o.v ? 'border-violet-700 bg-violet-700/20 text-violet-300' : 'border-zinc-800 bg-zinc-900 text-zinc-300'}`}
                      onClick={()=> setHasIce(o.v)}
                    >{o.label}</button>
                  ))}
                </div>
                <div className="text-xs text-zinc-500 mt-1">When a status is selected, it overrides this toggle.</div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" onClick={()=>{ startTransition(()=>{ setFilters({ full_name:'', title:'', company_name:'', email:'' }); setHasIce('all'); setStatusFilter(null); setPage(1); setFiltersOpen(false) }); load() }}>Clear</Button>
              <Button className="bg-violet-600 hover:bg-violet-500" onClick={()=>{ startTransition(()=>{ setPage(1); setFiltersOpen(false) }); load() }}>Apply</Button>
            </div>
          </DialogContent>
        </Dialog>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" className="bg-zinc-900 border border-zinc-800">View</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-zinc-950 border-zinc-800">
            <DropdownMenuLabel>Density</DropdownMenuLabel>
            <DropdownMenuCheckboxItem checked={density==='comfortable'} onCheckedChange={()=>setDensity('comfortable')}>Comfortable</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={density==='compact'} onCheckedChange={()=>setDensity('compact')}>Compact</DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Columns</DropdownMenuLabel>
            {['full_name','title','company_name','company_website','email','industry','city','state','country','ice_status'].map(k=> (
              <DropdownMenuCheckboxItem key={k} checked={!!visibleCols[k]} onCheckedChange={(v)=> setVisibleCols(c=> ({ ...c, [k]: Boolean(v) }))}>
                {k.replace('_',' ')}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="secondary" className="bg-zinc-900 border border-zinc-800" disabled={purging}>{purging? 'Purging…' : 'Purge queued'}</Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-zinc-950 border-zinc-800">
            <AlertDialogHeader>
              <AlertDialogTitle>Remove all queued leads?</AlertDialogTitle>
              <AlertDialogDescription>
                This will reset the status of all queued leads to "none" for this campaign.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-zinc-900 border border-zinc-800">Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-violet-600 hover:bg-violet-500" onClick={purgeQueued}>Confirm</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-zinc-400">Sort</span>
          <select className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded" value={sortBy} onChange={e=>{ setSortBy(e.target.value as any); setPage(1) }}>
            <option value="created_at">Created</option>
            <option value="full_name">Name</option>
            <option value="company_name">Company</option>
            <option value="email">Email</option>
            <option value="ice_status">Ice</option>
          </select>
          <select className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded" value={sortDir} onChange={e=>{ setSortDir(e.target.value as any); setPage(1) }}>
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </select>
        </div>
      </div>
      {selectedIds.length>0 && (
        <div className="flex items-center gap-3 text-sm text-zinc-300 bg-zinc-900/60 border border-zinc-800 rounded px-3 py-2">
          <span>{selectedIds.length} selected</span>
          <Button variant="secondary" className="bg-zinc-800/60" onClick={()=>enrich(selectedIds)} disabled={enriching}>{enriching? 'Enriching…' : 'Enrich selected'}</Button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Set status</span>
            <select className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded" onChange={async (e)=>{
              const v = e.target.value
              if (!v) return
              await fetch('/api/leads/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'status', status: v, ids: selectedIds }) })
              setSelected({})
              setPollUntil(Date.now() + 30000)
              await load()
              e.currentTarget.value = ''
            }} defaultValue="">
              <option value="" disabled>Choose…</option>
              {['none','queued','processing','done','error'].map(s=> <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Delete selected</Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-zinc-950 border-zinc-800">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {selectedIds.length} leads?</AlertDialogTitle>
                <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-zinc-900 border border-zinc-800">Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-red-600 hover:bg-red-500" onClick={async ()=>{
                  await fetch('/api/leads/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', ids: selectedIds }) })
                  setSelected({})
                  await load()
                }}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="secondary" className="bg-zinc-800/60" onClick={()=>setSelected({})}>Clear</Button>
        </div>
      )}

      <div className="overflow-x-auto border border-zinc-800 rounded">
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
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 max-w-3xl">
          <DialogHeader>
            <DialogTitle>Lead details</DialogTitle>
          </DialogHeader>
          {detailsLead && (
            <div className="space-y-4">
              <div className="text-sm text-zinc-300">
                <div className="font-medium text-white">{detailsLead.full_name || '(No name)'} • {detailsLead.company_name || ''}</div>
                <div className="text-xs text-zinc-500">{detailsLead.email || ''}</div>
              </div>
              <div>
                <label className="text-xs text-zinc-400">Status</label>
                <div className="mt-1">
                  <select className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded" value={statusDraft} onChange={(e)=>setStatusDraft(e.target.value)}>
                    {['none','queued','processing','done','error'].map(s=> <option key={s} value={s}>{s}</option>)}
                  </select>
                  <Button className="ml-2 bg-violet-600 hover:bg-violet-500" onClick={async ()=>{
                    if (!detailsLead) return
                    await fetch(`/api/leads/${detailsLead.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ice_status: statusDraft }) })
                    setData(d=> d.map(l=> l.id===detailsLead.id? { ...l, ice_status: statusDraft }: l))
                  }}>Save</Button>
                </div>
                {detailsLead.ice_status === 'error' && jobError && (
                  <div className="mt-3 text-sm">
                    <div className="text-xs text-red-300 mb-1">Last error</div>
                    <pre className="bg-zinc-900 border border-red-900/40 text-red-300 rounded p-2 whitespace-pre-wrap break-words">{jobError}</pre>
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-zinc-400">Ice breaker</label>
                <pre className="mt-1 max-h-96 overflow-auto whitespace-pre-wrap break-words bg-zinc-900 border border-zinc-800 rounded p-3 text-zinc-200">{detailsLead.ice_breaker || '—'}</pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-3 sticky bottom-0 z-30 bg-zinc-950 border-t border-zinc-800 py-2">
        <Button variant="secondary" className="bg-zinc-900 border border-zinc-800" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}>Prev</Button>
        <span>Page {page}</span>
        <Button variant="secondary" className="bg-zinc-900 border border-zinc-800" onClick={()=>{
          if (page*pageSize < total) setPage(p=>p+1)
        }} disabled={page*pageSize>=total}>Next</Button>
        <select className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded" value={pageSize} onChange={(e)=>{ const v = Number(e.target.value); setPageSize(v); setPage(1); setTimeout(()=>load(), 0) }}>
          {[25,50,100,200].map(n=> <option key={n} value={n}>{n}/page</option>)}
        </select>
        <span className="text-sm text-zinc-400">Total: {total}</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-zinc-400">Freeze first</span>
          <select className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded" value={frozenCount} onChange={(e)=>setFrozenCount(Number(e.target.value))}>
            {[0,1,2,3,4,5,6,7,8].map(n=> <option key={n} value={n}>{n}</option>)}
          </select>
          <span className="text-xs text-zinc-400">columns</span>
        </div>
      </div>
    </main>
  )
}

function ErrorBlock({ leadId }: { leadId: string }) {
  const [msg, setMsg] = useState<string>('')
  useEffect(()=>{
    let cancelled = false
    ;(async()=>{
      try {
        const res = await fetch(`/api/leads/${leadId}/job`)
        const j = await res.json()
        if (!cancelled && res.ok) setMsg(j.job?.error || '')
      } catch {}
    })()
    return ()=>{ cancelled = true }
  }, [leadId])
  if (!msg) return null
  return (
    <div className="mt-3 text-sm">
      <div className="text-xs text-red-300 mb-1">Last error</div>
      <pre className="bg-zinc-900 border border-red-900/40 text-red-300 rounded p-2 whitespace-pre-wrap break-words">{msg}</pre>
    </div>
  )
}


