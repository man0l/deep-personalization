"use client"
import React, { useSyncExternalStore, memo } from 'react'
import { Checkbox } from '@/components/ui/checkbox'

type Listener = () => void

class SelectionStore {
  private selected: Record<string, boolean> = {}
  private keyListeners: Map<string, Set<Listener>> = new Map()
  private allListeners: Set<Listener> = new Set()

  subscribeKey(id: string, listener: Listener) {
    let set = this.keyListeners.get(id)
    if (!set) {
      set = new Set()
      this.keyListeners.set(id, set)
    }
    set.add(listener)
    return () => {
      set!.delete(listener)
      if (set!.size === 0) this.keyListeners.delete(id)
    }
  }

  subscribeAll(listener: Listener) {
    this.allListeners.add(listener)
    return () => { this.allListeners.delete(listener) }
  }

  isSelected(id: string) {
    return !!this.selected[id]
  }

  set(id: string, value: boolean) {
    const prev = !!this.selected[id]
    if (prev === value) return
    if (value) this.selected[id] = true
    else delete this.selected[id]
    this.notifyKey(id)
    this.notifyAll()
  }

  toggle(id: string) {
    this.set(id, !this.isSelected(id))
  }

  clear() {
    const previouslySelectedIds = Object.keys(this.selected)
    this.selected = {}
    for (const id of previouslySelectedIds) this.notifyKey(id)
    this.notifyAll()
  }

  setMany(ids: string[], value: boolean) {
    let changed = false
    for (const id of ids) {
      const prev = !!this.selected[id]
      if (value && !prev) { this.selected[id] = true; changed = true; this.notifyKey(id) }
      if (!value && prev) { delete this.selected[id]; changed = true; this.notifyKey(id) }
    }
    if (changed) this.notifyAll()
  }

  getSelectedIds(): string[] {
    return Object.keys(this.selected)
  }

  private notifyKey(id: string) {
    const set = this.keyListeners.get(id)
    if (!set) return
    for (const l of Array.from(set)) l()
  }

  private notifyAll() {
    for (const l of Array.from(this.allListeners)) l()
  }
}

export const selectionStore = new SelectionStore()

export const SelectionCheckbox = memo(function SelectionCheckbox({ id }: { id: string }) {
  const checked = useSyncExternalStore(
    (listener) => selectionStore.subscribeKey(id, listener),
    () => selectionStore.isSelected(id),
    () => false
  )

  return (
    <Checkbox
      checked={checked}
      onCheckedChange={(v)=> selectionStore.set(id, Boolean(v))}
    />
  )
})

export const HeaderSelectionCheckbox = memo(function HeaderSelectionCheckbox({ ids }: { ids: string[] }) {
  const tick = useSyncExternalStore(
    (l)=> selectionStore.subscribeAll(l),
    () => selectionStore.getSelectedIds().length,
    () => 0
  )
  const allChecked = ids.length > 0 && ids.every(id => selectionStore.isSelected(id))
  const someChecked = ids.length > 0 && !allChecked && ids.some(id => selectionStore.isSelected(id))
  const checkedValue: boolean | 'indeterminate' = allChecked ? true : (someChecked ? 'indeterminate' : false)
  return (
    <Checkbox
      checked={checkedValue as any}
      onCheckedChange={(v)=> selectionStore.setMany(ids, Boolean(v))}
    />
  )
})


