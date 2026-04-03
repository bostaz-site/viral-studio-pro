"use client"

import { useState, useRef, useEffect } from 'react'
import { Bell, Flame, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useTrendingStore } from '@/stores/trending-store'
import { cn } from '@/lib/utils'

const PLATFORM_COLORS: Record<string, string> = {
  twitch: 'text-purple-400',
  youtube_gaming: 'text-red-400',
}

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'maintenant'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}j`
}

export function NotificationBell() {
  const { notifications, notificationsRead, markNotificationsRead } = useTrendingStore()
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const unreadCount = notificationsRead ? 0 : notifications.length

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  const handleToggle = () => {
    setOpen(!open)
    if (!open && !notificationsRead) {
      markNotificationsRead()
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 relative"
        onClick={handleToggle}
      >
        <Bell className={cn('h-4 w-4', unreadCount > 0 && 'text-orange-400')} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <Card className="absolute right-0 top-full mt-2 w-80 bg-card border-border shadow-xl z-50 animate-in slide-in-from-top-2 fade-in duration-200">
          <CardContent className="p-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold">Alertes virales</h3>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOpen(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="max-h-72 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center">
                  <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Aucune alerte pour le moment</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Les clips avec un velocity score &ge; 80 apparaîtront ici
                  </p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors border-b border-border/50 last:border-0"
                  >
                    <div className="p-1.5 rounded-lg bg-orange-500/15 shrink-0 mt-0.5">
                      <Flame className="h-3.5 w-3.5 text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground leading-tight truncate">
                        {notif.clipTitle}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={cn('text-xs font-medium', PLATFORM_COLORS[notif.platform] ?? 'text-muted-foreground')}>
                          {notif.platform}
                        </span>
                        <span className="text-[10px] text-orange-400 font-bold">
                          {notif.velocityScore.toFixed(0)}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60 ml-auto">
                          {timeAgo(notif.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
