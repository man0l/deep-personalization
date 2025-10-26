"use client"
import React, { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

export type FilterSpec =
  | { field: 'status', op: 'any'|'none', values: string[] }
  | { field: 'full_name'|'title'|'company_name'|'email', op: 'contains', value: string }

export function FilterBuilder({ value, onChange }: { value: FilterSpec[]; onChange: (v: FilterSpec[]) => void }) {
  const hasField = (f: FilterSpec['field']) => value.some(v => v.field === f)

  function addField(f: FilterSpec['field']) {
    if (hasField(f)) return
    const next: FilterSpec = f === 'status'
      ? { field: 'status', op: 'any', values: [] }
      : { field: f as any, op: 'contains', value: '' }
    onChange([...value, next])
  }

  function removeField(f: FilterSpec['field']) {
    onChange(value.filter(v => v.field !== f))
  }

  function updateSpec(f: FilterSpec['field'], spec: Partial<FilterSpec>) {
    onChange(value.map(v => v.field === f ? ({ ...v, ...spec } as any) : v))
  }

  const statusSpec = value.find(v => v.field === 'status') as Extract<FilterSpec,{field:'status'}> | undefined
  const textSpecs = value.filter(v => v.field !== 'status') as Extract<FilterSpec,{op:'contains'}>[]

  const availableFields: FilterSpec['field'][] = useMemo(()=>[
    ...(['status'] as const),
    ...(['full_name','title','company_name','email'] as const)
  ].filter(f=> !hasField(f) ), [value])

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Add Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" className="bg-zinc-900 border border-zinc-800">+ Add Filter</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="bg-zinc-950 border-zinc-800">
          {availableFields.map(f=> (
            <DropdownMenuItem key={f} className="capitalize" onClick={()=> addField(f)}>{String(f).replace('_',' ')}</DropdownMenuItem>
          ))}
          {availableFields.length===0 && (
            <div className="px-2 py-1 text-xs text-zinc-500">No more fields</div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Status pill */}
      {statusSpec && (
        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded px-2 py-1">
          <span className="text-xs text-zinc-400">Status</span>
          <select className="px-1 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-xs" value={statusSpec.op} onChange={(e)=> updateSpec('status', { op: e.target.value as any })}>
            <option value="any">is any of</option>
            <option value="none">is none of</option>
          </select>
          <select multiple className="px-1 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-xs min-w-36 h-18"
            value={statusSpec.values}
            onChange={(e)=>{
              const opts = Array.from(e.target.selectedOptions).map(o=> o.value)
              updateSpec('status', { values: opts } as any)
            }}
          >
            {['none','queued','processing','done','error'].map(s=> <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="text-xs text-zinc-500 hover:text-zinc-300" onClick={()=> removeField('status')}>✕</button>
        </div>
      )}

      {/* Text pills */}
      {textSpecs.map(ts=> (
        <div key={ts.field} className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded px-2 py-1">
          <span className="text-xs text-zinc-400 capitalize">{String(ts.field).replace('_',' ')}</span>
          <span className="text-xs text-zinc-500">contains</span>
          <input className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-xs" value={ts.value} onChange={(e)=> updateSpec(ts.field, { value: e.target.value } as any)} />
          <button className="text-xs text-zinc-500 hover:text-zinc-300" onClick={()=> removeField(ts.field)}>✕</button>
        </div>
      ))}
    </div>
  )
}


