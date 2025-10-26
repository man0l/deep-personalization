"use client"
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

export function PaginationBar({
  page,
  setPage,
  pageSize,
  setPageSize,
  total,
  frozenCount,
  setFrozenCount,
  scrollTargetRef,
}: {
  page: number
  setPage: (u: (p:number)=>number | number) => void
  pageSize: number
  setPageSize: (n:number)=>void
  total: number
  frozenCount: number
  setFrozenCount: (n:number)=>void
  scrollTargetRef?: React.RefObject<HTMLDivElement | null>
}) {
  const proxyRef = useRef<HTMLDivElement | null>(null)
  const [contentWidth, setContentWidth] = useState<number>(0)

  useEffect(()=>{
    const target = scrollTargetRef?.current || null
    const proxy = proxyRef.current
    if (!target || !proxy) return

    // Ensure proxy reflects full scrollable width of the table container
    const updateSizes = () => {
      // The scrollable content should match the target's scrollWidth
      setContentWidth(target.scrollWidth)
    }
    updateSizes()

    let isSyncing = false
    const onProxyScroll = () => {
      if (!target || !proxy) return
      isSyncing = true
      target.scrollLeft = proxy.scrollLeft
      isSyncing = false
    }
    const onTargetScroll = () => {
      if (!proxy) return
      if (isSyncing) return
      proxy.scrollLeft = target.scrollLeft
    }

    proxy.addEventListener('scroll', onProxyScroll, { passive: true })
    target.addEventListener('scroll', onTargetScroll, { passive: true })

    // Keep widths in sync via ResizeObserver
    const ro = new ResizeObserver(() => updateSizes())
    ro.observe(target)
    // Observe the first child inside target (the actual table) if present
    if (target.firstElementChild) ro.observe(target.firstElementChild as Element)

    // Initialize positions
    proxy.scrollLeft = target.scrollLeft

    return () => {
      proxy.removeEventListener('scroll', onProxyScroll)
      target.removeEventListener('scroll', onTargetScroll)
      ro.disconnect()
    }
  }, [scrollTargetRef?.current])

  return (
    <div className="sticky bottom-0 z-30 bg-zinc-950 border-t border-zinc-800">
      <div className="flex items-center gap-3 py-2">
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
      {/* Spreadsheet-like horizontal scrollbar proxy */}
      <div ref={proxyRef} className="overflow-x-auto w-full h-4 bg-zinc-950">
        <div style={{ width: contentWidth, height: 1 }} />
      </div>
    </div>
  )
}


