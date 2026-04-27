// TODO: Wire this component — custom tooltip, use for hover hints on badges/buttons
"use client"

import { useState, useRef, useCallback, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface TooltipProps {
  children: ReactNode
  content: ReactNode
  side?: 'top' | 'bottom'
  delayDuration?: number
  className?: string
}

export function Tooltip({ children, content, side = 'top', delayDuration = 200, className }: TooltipProps) {
  const [open, setOpen] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback(() => {
    timeoutRef.current = setTimeout(() => setOpen(true), delayDuration)
  }, [delayDuration])

  const hide = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setOpen(false)
  }, [])

  return (
    <div className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {open && (
        <div
          role="tooltip"
          className={cn(
            'absolute z-50 px-3 py-1.5 rounded-md bg-popover border border-border shadow-md',
            'animate-in fade-in-0 zoom-in-95',
            side === 'top' && 'bottom-full left-1/2 -translate-x-1/2 mb-2',
            side === 'bottom' && 'top-full left-1/2 -translate-x-1/2 mt-2',
            className
          )}
        >
          {content}
        </div>
      )}
    </div>
  )
}
