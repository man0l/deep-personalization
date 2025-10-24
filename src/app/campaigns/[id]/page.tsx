"use client"
import { useEffect, useMemo, useState } from 'react'
import { ColumnDef, flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

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

export default function CampaignDetail({ params }: { params: { id: string } }) {
  const [data, setData] = useState<Lead[]>([])
  const [total, setTotal] = useState(0)
  const [totals, setTotals] = useState<Record<string, number>>({})
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [q, setQ] = useState('')
  const [hasIce, setHasIce] = useState<'all'|'true'|'false'>('all')
  const [selected, setSelected] = useState<Record<string, boolean>>({})

  async function load() {
    // stats
    const statsRes = await fetch(`/api/campaigns/${params.id}`, { cache: 'no-store' })
    const stats = await statsRes.json()
    if (statsRes.ok) setTotals(stats.totals || {})
    const paramsQ = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (q) paramsQ.set('q', q)
    if (hasIce !== 'all') paramsQ.set('hasIce', hasIce)
    const res = await fetch(`/api/campaigns/${params.id}/leads?` + paramsQ.toString(), { cache: 'no-store' })
    const json = await res.json()
    if (res.ok) {
      setData(json.leads)
      setTotal(json.total)
      setSelected({})
    }
  }

  useEffect(() => { load() }, [page, pageSize, hasIce])

  const columns = useMemo<ColumnDef<Lead>[]>(() => [
    { header: '', id: 'select', cell: ({ row }) => (
      <input type="checkbox" checked={!!selected[row.original.id]} onChange={e=>setSelected(s=>({ ...s, [row.original.id]: e.target.checked }))} />
    ) },
    { header: 'Name', accessorKey: 'full_name' },
    { header: 'Title', accessorKey: 'title' },
    { header: 'Company', accessorKey: 'company_name' },
    { header: 'Website', accessorKey: 'company_website' },
    { header: 'Email', accessorKey: 'email' },
    { header: 'Industry', accessorKey: 'industry' },
    { header: 'City', accessorKey: 'city' },
    { header: 'State', accessorKey: 'state' },
    { header: 'Country', accessorKey: 'country' },
    { header: 'Ice', accessorKey: 'ice_status' },
    { header: 'Actions', id: 'actions', cell: ({ row }) => (
      <div className="flex gap-2">
        <button className="underline" onClick={()=>enrich([row.original.id])}>Enrich</button>
        <button className="underline" onClick={async ()=>{ await fetch(`/api/leads/${row.original.id}`, { method: 'DELETE' }); await load() }}>Delete</button>
      </div>
    ) },
  ], [selected])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
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
      </div>

      <div className="overflow-auto border border-zinc-800 rounded">
        <table className="min-w-full text-sm">
          <thead>
            {table.getHeaderGroups().map(hg=> (
              <tr key={hg.id} className="bg-zinc-900">
                {hg.headers.map(h=> (
                  <th key={h.id} className="text-left p-2 border-b border-zinc-800">
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(r=> (
              <tr key={r.id} className="odd:bg-zinc-900">
                {r.getVisibleCells().map(c=> (
                  <td key={c.id} className="p-2 border-b border-zinc-800">{flexRender(c.column.columnDef.cell, c.getContext())}</td>
                ))}
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
        <select className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded" value={pageSize} onChange={(e)=>{ setPageSize(Number(e.target.value)); setPage(1) }}>
          {[25,50,100,200].map(n=> <option key={n} value={n}>{n}/page</option>)}
        </select>
        <span className="text-sm text-zinc-400">Total: {total}</span>
      </div>
    </main>
  )
}


