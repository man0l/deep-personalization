"use client"
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type Filters = { full_name: string; title: string; company_name: string; email: string }

export function FiltersDialog({
  open,
  onOpenChange,
  filters,
  setFilters,
  statusFilter,
  setStatusFilter,
  hasIce,
  setHasIce,
  apply,
  clear,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  filters: Filters
  setFilters: (f: Filters) => void
  statusFilter: 'queued'|'processing'|'error'|'done'|null
  setStatusFilter: (s: 'queued'|'processing'|'error'|'done'|null) => void
  hasIce: 'all'|'true'|'false'
  setHasIce: (v: 'all'|'true'|'false') => void
  apply: () => void
  clear: () => void
}) {
  const [isPending, startTransition] = useTransition()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          <Button variant="secondary" onClick={()=> startTransition(()=> clear())}>Clear</Button>
          <Button className="bg-violet-600 hover:bg-violet-500" onClick={()=> startTransition(()=> apply())}>Apply</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}


