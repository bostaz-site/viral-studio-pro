"use client"

import { useState } from 'react'
import { AlertCircle, AlertTriangle, WifiOff, Server, Lock, CreditCard, RotateCcw, ChevronDown, ChevronUp, Mail } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type ErrorKind =
  | 'generic'    // default red
  | 'network'    // offline / fetch failed
  | 'server'     // VPS / 5xx
  | 'auth'       // 401/403 / session expired
  | 'quota'      // plan limit reached
  | 'timeout'    // polling gave up
  | 'validation' // user input invalid

interface ErrorCardProps {
  kind?: ErrorKind
  title: string
  /** Human-friendly explanation (1-2 sentences). */
  description?: string
  /** Raw technical details — shown in a collapsible section. */
  details?: string
  /** Primary action (usually Retry). */
  onRetry?: () => void
  retryLabel?: string
  /** Secondary action (e.g. upgrade, contact). */
  secondaryAction?: {
    label: string
    onClick?: () => void
    href?: string
    icon?: React.ElementType
  }
  /** Extra className for the outer Card (layout tweaks). */
  className?: string
}

const KIND_CONFIG: Record<ErrorKind, {
  icon: React.ElementType
  borderClass: string
  bgClass: string
  iconBgClass: string
  iconColorClass: string
}> = {
  generic: {
    icon: AlertCircle,
    borderClass: 'border-destructive/40',
    bgClass: 'bg-destructive/5',
    iconBgClass: 'bg-destructive/15',
    iconColorClass: 'text-destructive',
  },
  network: {
    icon: WifiOff,
    borderClass: 'border-amber-500/40',
    bgClass: 'bg-amber-500/5',
    iconBgClass: 'bg-amber-500/15',
    iconColorClass: 'text-amber-400',
  },
  server: {
    icon: Server,
    borderClass: 'border-rose-500/40',
    bgClass: 'bg-rose-500/5',
    iconBgClass: 'bg-rose-500/15',
    iconColorClass: 'text-rose-400',
  },
  auth: {
    icon: Lock,
    borderClass: 'border-blue-500/40',
    bgClass: 'bg-blue-500/5',
    iconBgClass: 'bg-blue-500/15',
    iconColorClass: 'text-blue-400',
  },
  quota: {
    icon: CreditCard,
    borderClass: 'border-purple-500/40',
    bgClass: 'bg-purple-500/5',
    iconBgClass: 'bg-purple-500/15',
    iconColorClass: 'text-purple-400',
  },
  timeout: {
    icon: AlertTriangle,
    borderClass: 'border-yellow-500/40',
    bgClass: 'bg-yellow-500/5',
    iconBgClass: 'bg-yellow-500/15',
    iconColorClass: 'text-yellow-400',
  },
  validation: {
    icon: AlertCircle,
    borderClass: 'border-orange-500/40',
    bgClass: 'bg-orange-500/5',
    iconBgClass: 'bg-orange-500/15',
    iconColorClass: 'text-orange-400',
  },
}

export function ErrorCard({
  kind = 'generic',
  title,
  description,
  details,
  onRetry,
  retryLabel = 'Réessayer',
  secondaryAction,
  className,
}: ErrorCardProps) {
  const [showDetails, setShowDetails] = useState(false)
  const config = KIND_CONFIG[kind]
  const Icon = config.icon
  const SecondaryIcon = secondaryAction?.icon ?? Mail

  return (
    <Card className={cn('border', config.borderClass, config.bgClass, className)}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className={cn('shrink-0 w-10 h-10 rounded-full flex items-center justify-center', config.iconBgClass)}>
            <Icon className={cn('h-5 w-5', config.iconColorClass)} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            {description && (
              <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
            )}
          </div>
        </div>

        {(onRetry || secondaryAction) && (
          <div className="flex flex-wrap items-center gap-2 pl-[52px]">
            {onRetry && (
              <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={onRetry}>
                <RotateCcw className="h-3.5 w-3.5" />
                {retryLabel}
              </Button>
            )}
            {secondaryAction && (
              secondaryAction.href ? (
                <a
                  href={secondaryAction.href}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                >
                  <SecondaryIcon className="h-3.5 w-3.5" />
                  {secondaryAction.label}
                </a>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 h-8 text-muted-foreground hover:text-foreground"
                  onClick={secondaryAction.onClick}
                >
                  <SecondaryIcon className="h-3.5 w-3.5" />
                  {secondaryAction.label}
                </Button>
              )
            )}
          </div>
        )}

        {details && (
          <div className="pl-[52px]">
            <button
              onClick={() => setShowDetails((v) => !v)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              Détails techniques
            </button>
            {showDetails && (
              <pre className="mt-2 text-[11px] text-muted-foreground bg-background/60 border border-border rounded-md p-2 overflow-x-auto whitespace-pre-wrap break-words max-h-40">
                {details}
              </pre>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Classify a raw error message / status into an ErrorKind so the caller
 * can just hand the error to ErrorCard without switching itself.
 */
export function classifyError(raw: string | null | undefined, status?: number): ErrorKind {
  if (status === 401 || status === 403) return 'auth'
  if (status === 402 || status === 429) return 'quota'
  if (status && status >= 500) return 'server'
  if (!raw) return 'generic'
  const msg = raw.toLowerCase()
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('réseau') || msg.includes('offline')) return 'network'
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('plus longtemps')) return 'timeout'
  if (msg.includes('quota') || msg.includes('limit') || msg.includes('plan')) return 'quota'
  if (msg.includes('unauthor') || msg.includes('forbidden') || msg.includes('session')) return 'auth'
  if (msg.includes('vps') || msg.includes('render') || msg.includes('ffmpeg') || msg.includes('server')) return 'server'
  return 'generic'
}
