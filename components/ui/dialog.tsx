"use client"

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DialogProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
}

export function Dialog({ open, onClose, title, description, children, className }: DialogProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-50 bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto',
          className
        )}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors z-10"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {(title || description) && (
          <div className="px-6 pt-6 pb-4 border-b border-border">
            {title && <h2 className="text-lg font-bold text-foreground pr-8">{title}</h2>}
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
          </div>
        )}

        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
