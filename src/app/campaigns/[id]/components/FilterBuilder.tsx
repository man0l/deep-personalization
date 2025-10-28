"use client"
import React, { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

export type FilterSpec =
  | { field: 'status', op: 'any'|'none', values: string[] }
  | { field: 'full_name'|'title'|'company_name'|'email', op: 'contains', value: string }
  | { field: 'company_website', op: 'like'|'empty'|'not_empty', value?: string }
  | { field: 'email_like', op: 'like'|'empty'|'not_empty', value?: string }
  | { field: 'verification', op: 'is', value: 'unverified'|'verified_ok'|'verified_bad'|'verified_unknown' }

export function FilterBuilder({ value, onChange }: { value: FilterSpec[]; onChange: (v: FilterSpec[]) => void }) {
  const hasField = (f: FilterSpec['field']) => value.some(v => v.field === f)

  function addField(f: FilterSpec['field']) {
    if (hasField(f)) return
    const next: FilterSpec = f === 'status'
      ? { field: 'status', op: 'any', values: [] }
      : f === 'company_website'
        ? { field: 'company_website', op: 'like', value: '' }
        : f === 'email_like'
          ? { field: 'email_like', op: 'like', value: '' }
        : f === 'verification'
          ? { field: 'verification', op: 'is', value: 'unverified' }
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
  const websiteSpec = value.find(v => v.field === 'company_website') as Extract<FilterSpec,{field:'company_website'}> | undefined
  const emailLikeSpec = value.find(v => v.field === 'email_like') as Extract<FilterSpec,{field:'email_like'}> | undefined
  const verificationSpec = value.find(v => v.field === 'verification') as Extract<FilterSpec,{field:'verification'}> | undefined
  const textSpecs = value.filter(v => v.field !== 'status' && v.field !== 'company_website' && v.field !== 'email_like') as Extract<FilterSpec,{op:'contains'}>[]

  const availableFields: FilterSpec['field'][] = useMemo(()=>[
    ...(['status'] as const),
    ...(['full_name','title','company_name','email','company_website','email_like','verification'] as const)
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

      {/* Website pill */}
      {websiteSpec && (
        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded px-2 py-1">
          <span className="text-xs text-zinc-400">Website</span>
          <select
            className="px-1 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-xs"
            value={websiteSpec.op}
            onChange={(e)=> updateSpec('company_website', { op: e.target.value as any } as any)}
          >
            <option value="like">like</option>
            <option value="empty">empty</option>
            <option value="not_empty">not empty</option>
          </select>
          {websiteSpec.op === 'like' && (
            <input
              className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-xs"
              value={websiteSpec.value || ''}
              placeholder="e.g. .io or github"
              onChange={(e)=> updateSpec('company_website', { value: e.target.value } as any)}
            />
          )}
          <button className="text-xs text-zinc-500 hover:text-zinc-300" onClick={()=> removeField('company_website')}>✕</button>
        </div>
      )}

      {/* Email pill */}
      {/* Verification pill */}
      {verificationSpec && (
        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded px-2 py-1">
          <span className="text-xs text-zinc-400">Verification</span>
          <select
            className="px-1 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-xs"
            value={verificationSpec.value}
            onChange={(e)=> updateSpec('verification', { value: e.target.value as any } as any)}
          >
            <option value="unverified">Not verified</option>
            <option value="verified_ok">Verified OK</option>
            <option value="verified_bad">Verified Bad</option>
            <option value="verified_unknown">Verified Unknown</option>
          </select>
          <button className="text-xs text-zinc-500 hover:text-zinc-300" onClick={()=> removeField('verification')}>✕</button>
        </div>
      )}
      {emailLikeSpec && (
        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded px-2 py-1">
          <span className="text-xs text-zinc-400">Email</span>
          <select
            className="px-1 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-xs"
            value={emailLikeSpec.op}
            onChange={(e)=> updateSpec('email_like', { op: e.target.value as any } as any)}
          >
            <option value="like">like</option>
            <option value="empty">empty</option>
            <option value="not_empty">not empty</option>
          </select>
          {emailLikeSpec.op === 'like' && (
            <input
              className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-xs"
              value={emailLikeSpec.value || ''}
              placeholder="e.g. gmail.com"
              onChange={(e)=> updateSpec('email_like', { value: e.target.value } as any)}
            />
          )}
          <button className="text-xs text-zinc-500 hover:text-zinc-300" onClick={()=> removeField('email_like')}>✕</button>
        </div>
      )}
    </div>
  )
}


