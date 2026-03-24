"use client"

import { useState } from 'react'
import { Loader2, CheckCircle2, Link2Off } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface SocialAccount {
  id: string
  platform: string
  username: string | null
  connected_at: string | null
}

interface PlatformDef {
  id: 'tiktok' | 'instagram' | 'youtube'
  label: string
  color: string
  icon: React.ReactNode
}

const PLATFORMS: PlatformDef[] = [
  {
    id: 'tiktok',
    label: 'TikTok',
    color: 'text-pink-400',
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.84a8.27 8.27 0 004.84 1.55V6.94a4.85 4.85 0 01-1.07-.25z" />
      </svg>
    ),
  },
  {
    id: 'instagram',
    label: 'Instagram',
    color: 'text-fuchsia-400',
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
  },
  {
    id: 'youtube',
    label: 'YouTube',
    color: 'text-red-400',
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z" />
      </svg>
    ),
  },
]

interface Props {
  accounts: SocialAccount[]
  onDisconnect: (id: string) => void
}

export function SocialConnect({ accounts, onDisconnect }: Props) {
  const [connecting, setConnecting] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)

  const connectedMap = new Map(accounts.map((a) => [a.platform, a]))

  const handleConnect = (platformId: string) => {
    setConnecting(platformId)
    window.location.href = `/api/social/connect?platform=${platformId}`
  }

  const handleDisconnect = async (account: SocialAccount) => {
    setDisconnecting(account.id)
    try {
      await fetch(`/api/social/accounts?id=${account.id}`, { method: 'DELETE' })
      onDisconnect(account.id)
    } finally {
      setDisconnecting(null)
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {PLATFORMS.map((platform) => {
        const account = connectedMap.get(platform.id)
        const isConnecting = connecting === platform.id
        const isDisconnecting = disconnecting === account?.id

        return (
          <Card
            key={platform.id}
            className={`bg-card/50 border-border transition-colors ${
              account ? 'border-primary/30' : ''
            }`}
          >
            <CardContent className="p-5 space-y-4">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className={`${platform.color}`}>{platform.icon}</div>
                <div>
                  <p className="font-semibold text-foreground">{platform.label}</p>
                  {account ? (
                    <p className="text-xs text-muted-foreground truncate max-w-[120px]">
                      @{account.username ?? 'connecté'}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Non connecté</p>
                  )}
                </div>
                {account && (
                  <CheckCircle2 className="h-4 w-4 text-green-400 ml-auto shrink-0" />
                )}
              </div>

              {/* Action */}
              {account ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 text-destructive hover:text-destructive hover:border-destructive/50"
                  onClick={() => handleDisconnect(account)}
                  disabled={isDisconnecting}
                >
                  {isDisconnecting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Link2Off className="h-3.5 w-3.5" />
                  )}
                  Déconnecter
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => handleConnect(platform.id)}
                  disabled={isConnecting}
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                      Connexion…
                    </>
                  ) : (
                    `Connecter ${platform.label}`
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
