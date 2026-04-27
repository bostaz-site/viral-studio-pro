'use client'

import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePwaInstall } from '@/hooks/use-pwa-install'

const DISMISS_KEY = 'vsp:pwa-dismiss'
const DISMISS_DAYS = 7

export function InstallBanner() {
  const { canInstall, promptInstall } = usePwaInstall()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!canInstall) return
    try {
      const dismissed = localStorage.getItem(DISMISS_KEY)
      if (dismissed) {
        const expires = Number(dismissed)
        if (Date.now() < expires) return
      }
    } catch { /* localStorage unavailable */ }
    setVisible(true)
  }, [canInstall])

  const handleDismiss = () => {
    setVisible(false)
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 86400000))
    } catch { /* ignore */ }
  }

  const handleInstall = async () => {
    await promptInstall()
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border shadow-2xl">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-500">
          <Download className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Install Viral Animal</p>
          <p className="text-xs text-muted-foreground truncate">Faster access, native feel</p>
        </div>
        <Button
          size="sm"
          className="shrink-0 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold h-8 px-3 text-xs"
          onClick={handleInstall}
        >
          Install
        </Button>
        <button onClick={handleDismiss} className="shrink-0 p-1 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
