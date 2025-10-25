"use client"
import { Button } from '@/components/ui/button'

export function PaginationBar({
  page,
  setPage,
  pageSize,
  setPageSize,
  total,
  frozenCount,
  setFrozenCount,
}: {
  page: number
  setPage: (u: (p:number)=>number | number) => void
  pageSize: number
  setPageSize: (n:number)=>void
  total: number
  frozenCount: number
  setFrozenCount: (n:number)=>void
}) {
  return (
    <div className="flex items-center gap-3 sticky bottom-0 z-30 bg-zinc-950 border-t border-zinc-800 py-2">
      <Button variant="secondary" className="bg-zinc-900 border border-zinc-800" onClick={()=>setPage((p:number)=>Math.max(1,p-1))} disabled={page===1}>Prev</Button>
      <span>Page {page}</span>
      <Button variant="secondary" className="bg-zinc-900 border border-zinc-800" onClick={()=>{ if (page*pageSize < total) setPage((p:number)=>p+1) }} disabled={page*pageSize>=total}>Next</Button>
      <select className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded" value={pageSize} onChange={(e)=>{ const v = Number(e.target.value); setPageSize(v); setPage(1) }}>
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
  )
}


