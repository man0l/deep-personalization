"use client"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

export function ViewMenu({
  density,
  setDensity,
  visibleCols,
  setVisibleCols,
}: {
  density: 'comfortable'|'compact'
  setDensity: (d: 'comfortable'|'compact') => void
  visibleCols: Record<string, boolean>
  setVisibleCols: (u: Record<string, boolean>) => void
}) {
  return (
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
          <DropdownMenuCheckboxItem key={k} checked={!!visibleCols[k]} onCheckedChange={(v)=> setVisibleCols({ ...visibleCols, [k]: Boolean(v) })}>
            {k.replace('_',' ')}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}


