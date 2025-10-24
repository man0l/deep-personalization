"use client"
import * as React from "react"
import * as RaScrollArea from "@radix-ui/react-scroll-area"

export const ScrollArea = React.forwardRef<HTMLDivElement, { className?: string, children: React.ReactNode }>(
  ({ className, children }, ref) => {
    return (
      <RaScrollArea.Root ref={ref} className={className}>
        <RaScrollArea.Viewport data-sa-viewport className="w-full h-full">
          {children}
        </RaScrollArea.Viewport>
      </RaScrollArea.Root>
    )
  }
)
ScrollArea.displayName = 'ScrollArea'

export function ScrollBar({ orientation = 'vertical', className }: { orientation?: 'vertical'|'horizontal', className?: string }) {
  const isHorizontal = orientation === 'horizontal'
  return (
    <RaScrollArea.Scrollbar
      orientation={orientation}
      className={`${isHorizontal ? 'h-3' : 'w-3'} flex select-none touch-none p-0.5 transition-colors ${className || ''}`}
    >
      <RaScrollArea.Thumb
        className="bg-zinc-700 rounded-full flex-1"
        style={{ minWidth: isHorizontal ? 24 : undefined, minHeight: isHorizontal ? undefined : 24 }}
      />
    </RaScrollArea.Scrollbar>
  )
}


