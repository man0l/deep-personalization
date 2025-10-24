"use client"
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { ColumnDef, flexRender, getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'

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
  ice_status: string
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
    const base: Record<string, boolean> = {
      select: true, full_name: true, title: true, company_name: true, company_website: true, email: true,
      industry: true, city: true, state: true, country: true, ice_status: true, actions: true,
    }
    try { const v = localStorage.getItem(`view:${id}:visibleCols`); return v? { ...base, ...JSON.parse(v)}: base } catch { return base }
  })
  useEffect(()=>{ try { localStorage.setItem(`view:${id}:visibleCols`, JSON.stringify(visibleCols)) } catch{} }, [id, visibleCols])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState({ full_name: '', title: '', company_name: '', email: '' })
  const [sortBy, setSortBy] = useState<string>('created_at')
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc')
  const [selectAllBusy, setSelectAllBusy] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(()=>{ setMounted(true) }, [])

  async function load() {
    // stats
    const statsRes = await fetch(`/api/campaigns/${id}`, { cache: 'no-store' })
    const stats = await statsRes.json()
    if (statsRes.ok) setTotals(stats.totals || {})
    const paramsQ = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (q) paramsQ.set('q', q)
    if (hasIce !== 'all') paramsQ.set('hasIce', hasIce)
    if (filters.full_name) paramsQ.set('f_full_name', filters.full_name)
    if (filters.title) paramsQ.set('f_title', filters.title)
    if (filters.company_name) paramsQ.set('f_company_name', filters.company_name)
    if (filters.email) paramsQ.set('f_email', filters.email)
    if (sortBy) paramsQ.set('sortBy', sortBy)
    if (sortDir) paramsQ.set('sortDir', sortDir)
    const res = await fetch(`/api/campaigns/${id}/leads?` + paramsQ.toString(), { cache: 'no-store' })
    const json = await res.json()
    if (res.ok) {
      setData(json.leads)
      setTotal(json.total)
      setSelected({})
    }
  }

  useEffect(() => { load() }, [page, pageSize, hasIce, q, sortBy, sortDir, filters.full_name, filters.title, filters.company_name, filters.email])

  async function selectVisiblePageRows(flag: boolean) {
    const newSel = { ...selected }
    for (const r of table.getRowModel().rows) {
      const id = (r.original as any).id
      newSel[id] = flag
    }
    setSelected(newSel)
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
    setSelected(newSel)
    setSelectAllBusy(false)
  }

  const columns = useMemo<ColumnDef<Lead>[]>(() => [
    visibleCols.select ? { header: (
      <div className="flex items-center gap-2">
        <input type="checkbox" onChange={(e)=> selectVisiblePageRows(e.target.checked)} />
        <Button variant="secondary" className="h-6 px-2 bg-zinc-900 border border-zinc-800" onClick={selectAllFiltered} disabled={selectAllBusy}>{selectAllBusy? 'Selecting…' : 'Select all'}</Button>
      </div>
    ), id: 'select', cell: ({ row }: any) => (
      <input type="checkbox" checked={!!selected[row.original.id]} onChange={e=>setSelected(s=>({ ...s, [row.original.id]: e.target.checked }))} />
    ) } : undefined,
    visibleCols.full_name ? { header: 'Name', accessorKey: 'full_name' } : undefined,
    visibleCols.title ? { header: 'Title', accessorKey: 'title' } : undefined,
    visibleCols.company_name ? { header: 'Company', accessorKey: 'company_name' } : undefined,
    visibleCols.company_website ? { header: 'Website', accessorKey: 'company_website' } : undefined,
    visibleCols.email ? { header: 'Email', accessorKey: 'email' } : undefined,
    visibleCols.industry ? { header: 'Industry', accessorKey: 'industry' } : undefined,
    visibleCols.city ? { header: 'City', accessorKey: 'city' } : undefined,
    visibleCols.state ? { header: 'State', accessorKey: 'state' } : undefined,
    visibleCols.country ? { header: 'Country', accessorKey: 'country' } : undefined,
    visibleCols.ice_status ? { header: 'Ice', accessorKey: 'ice_status' } : undefined,
    visibleCols.actions ? { header: 'Actions', id: 'actions', cell: ({ row }: any) => (
      <div className="flex gap-2">
        <button className="underline" onClick={()=>enrich([row.original.id])}>Enrich</button>
        <button className="underline" onClick={async ()=>{ await fetch(`/api/leads/${row.original.id}`, { method: 'DELETE' }); await load() }}>Delete</button>
      </div>
    ) } : undefined,
  ].filter(Boolean) as ColumnDef<Lead>[], [selected, visibleCols])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const selectedIds = Object.entries(selected).filter(([,v])=>v).map(([k])=>k)

  async function enrich(ids: string[]) {
    if (ids.length === 0) return
    await fetch('/api/leads/enrich', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadIds: ids }) })
    await load()
  }

  async function enrichAllMissing() {
    const missing = data.filter(l=>l.ice_status !== 'done').map(l=>l.id)
    await enrich(missing)
  }

  // Views: sticky first N columns + wide table for smooth horizontal scroll
  const colWidths = [40, 220, 230, 300, 240, 260, 260, 180, 160, 170, 120, 160]
  const totalWidth = colWidths.reduce((a,b)=>a+b,0)
  const [frozenCount, setFrozenCount] = useState<number>(()=>{
    try { const v = localStorage.getItem(`view:${id}:frozenCount`); return v? Number(v):2 } catch { return 2 }
  })
  useEffect(()=>{ try { localStorage.setItem(`view:${id}:frozenCount`, String(frozenCount)) } catch{} }, [id, frozenCount])
  const leftOf = (i:number) => colWidths.slice(0,i).reduce((a,b)=>a+b,0)

  return (
    <main className="space-y-4">
      <div className="text-sm text-zinc-400 flex gap-4">
        <span>Total: {totals.total ?? 0}</span>
        <span>Done: {totals.done ?? 0}</span>
        <span>Queued: {totals.queued ?? 0}</span>
        <span>Processing: {totals.processing ?? 0}</span>
        <span>Error: {totals.error ?? 0}</span>
      </div>
      <div className="flex items-center gap-4">
        <Input placeholder="Search" value={q} onChange={(e)=>setQ(e.target.value)} onKeyDown={(e)=>{ if (e.key==='Enter') { setPage(1); load() } }} />
        <select className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded" value={hasIce} onChange={(e)=>{ setHasIce(e.target.value as any); setPage(1) }}>
          <option value="all">All</option>
          <option value="true">Has Ice</option>
          <option value="false">No Ice</option>
        </select>
        <Button onClick={()=>enrich(selectedIds)} disabled={selectedIds.length===0} className="bg-violet-600 hover:bg-violet-500">Enrich Selected</Button>
        <Button onClick={enrichAllMissing} variant="secondary" className="bg-violet-700/30 text-violet-300 hover:bg-violet-700/50">Enrich All Missing (page)</Button>
        <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
          <DialogTrigger asChild>
            <Button variant="secondary" className={`bg-zinc-900 border ${ (filters.full_name||filters.title||filters.company_name||filters.email)? 'border-violet-700 text-violet-300':'border-zinc-800'}`}>Filters</Button>
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
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" onClick={()=>{ setFilters({ full_name:'', title:'', company_name:'', email:'' }); setPage(1); setFiltersOpen(false); load() }}>Clear</Button>
              <Button className="bg-violet-600 hover:bg-violet-500" onClick={()=>{ setPage(1); setFiltersOpen(false); load() }}>Apply</Button>
            </div>
          </DialogContent>
        </Dialog>
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

      <div className="overflow-auto border border-zinc-800 rounded">
        <table className="text-sm" style={{ minWidth: totalWidth }}>
          <thead>
            {table.getHeaderGroups().map(hg=> (
              <tr key={hg.id} className="bg-zinc-900">
                {hg.headers.map((h, i)=> {
                  const isFrozen = mounted && i < frozenCount
                  return (
                    <th
                      key={h.id}
                      className={`text-left p-2 border-b border-zinc-800 ${isFrozen ? 'sticky z-20 bg-zinc-900' : ''}`}
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
                  return (
                    <td
                      key={c.id}
                      className={`p-2 border-b border-zinc-800 ${isFrozen ? 'sticky z-10 bg-zinc-950' : ''}`}
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

      <div className="flex items-center gap-3">
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


