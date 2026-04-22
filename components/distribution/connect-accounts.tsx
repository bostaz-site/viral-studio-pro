'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Loader2,
  CheckCircle2,
  ExternalLink,
  Unplug,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useDistributionStore, type SocialAccount } from '@/stores/distribution-store'

const PLATFORM_META: Record<
  string,
  {
    displayName: string
    description: string
    color: string
    bgColor: string
    borderColor: string
    icon: React.ReactNode
  }
> = {
  tiktok: {
    displayName: 'TikTok',
    description: 'Publish clips as TikTok videos',
    color: 'text-white',
    bgColor: 'bg-black',
    borderColor: 'border-zinc-700',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.88-2.88 2.89 2.89 0 0 1 2.88-2.88c.28 0 .56.04.82.11v-3.5a6.37 6.37 0 0 0-.82-.05A6.34 6.34 0 0 0 3.15 15.2a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.75a8.18 8.18 0 0 0 4.76 1.52V6.83a4.84 4.84 0 0 1-1-.14z" />
      </svg>
    ),
  },
  youtube: {
    displayName: 'YouTube',
    description: 'Upload clips as YouTube Shorts',
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current text-red-500" aria-hidden="true">
        <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 0 0 .5 6.19 31.67 31.67 0 0 0 0 12a31.67 31.67 0 0 0 .5 5.81 3.02 3.02 0 0 0 2.12 2.14c1.84.55 9.38.55 9.38.55s7.54 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14A31.67 31.67 0 0 0 24 12a31.67 31.67 0 0 0-.5-5.81zM9.75 15.02V8.98L15.5 12l-5.75 3.02z" />
      </svg>
    ),
  },
  instagram: {
    displayName: 'Instagram',
    description: 'Share clips as Instagram Reels',
    color: 'text-pink-500',
    bgColor: 'bg-pink-500/10',
    borderColor: 'border-pink-500/30',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current text-pink-500" aria-hidden="true">
        <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.17.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23a3.72 3.72 0 0 1-.9 1.38c-.42.42-.82.68-1.38.9-.42.17-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.72 3.72 0 0 1-1.38-.9 3.72 3.72 0 0 1-.9-1.38c-.17-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.17 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.78.3-1.44.71-2.1 1.37A5.87 5.87 0 0 0 .63 4.14C.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.3.78.71 1.44 1.37 2.1a5.87 5.87 0 0 0 2.14 1.37c.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56a5.87 5.87 0 0 0 2.14-1.37 5.87 5.87 0 0 0 1.37-2.1c.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.87 5.87 0 0 0-1.37-2.14A5.87 5.87 0 0 0 19.86.63C19.1.33 18.22.13 16.95.07 15.67.01 15.26 0 12 0zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm7.85-10.4a1.44 1.44 0 1 0-2.88 0 1.44 1.44 0 0 0 2.88 0z" />
      </svg>
    ),
  },
}

const PLATFORMS = ['tiktok', 'youtube', 'instagram'] as const

export function ConnectAccounts() {
  const {
    accounts,
    accountsLoading,
    accountsError,
    fetchAccounts,
    disconnectAccount,
  } = useDistributionStore()

  const searchParams = useSearchParams()
  const connectedPlatform = searchParams.get('connected')
  const oauthError = searchParams.get('oauth_error')

  const [disconnecting, setDisconnecting] = useState<string | null>(null)

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  const getAccountForPlatform = (platform: string): SocialAccount | undefined => {
    return accounts.find((a) => a.platform === platform)
  }

  const handleConnect = (platform: string) => {
    // Navigate to OAuth authorize endpoint
    window.location.href = `/api/oauth/${platform}/authorize`
  }

  const handleDisconnect = async (platform: string) => {
    setDisconnecting(platform)
    try {
      await disconnectAccount(platform)
    } catch {
      // Error handled by store
    } finally {
      setDisconnecting(null)
    }
  }

  return (
    <div className="space-y-3">
      {/* Success banner */}
      {connectedPlatform && PLATFORM_META[connectedPlatform] && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-3 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />
            <p className="text-sm text-green-400 font-medium">
              {PLATFORM_META[connectedPlatform].displayName} connected successfully!
            </p>
          </CardContent>
        </Card>
      )}

      {/* Error banner */}
      {oauthError && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-3 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
            <p className="text-sm text-red-400 font-medium">{oauthError}</p>
          </CardContent>
        </Card>
      )}

      {accountsError && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-3 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
            <p className="text-sm text-red-400">{accountsError}</p>
          </CardContent>
        </Card>
      )}

      {/* Platform cards */}
      {PLATFORMS.map((platform) => {
        const meta = PLATFORM_META[platform]
        const account = getAccountForPlatform(platform)
        const isConnected = !!account
        const isDisconnecting = disconnecting === platform

        return (
          <Card
            key={platform}
            className={`border transition-colors ${
              isConnected ? meta.borderColor : 'border-border'
            }`}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      isConnected ? meta.bgColor : 'bg-muted/40'
                    }`}
                  >
                    {meta.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {meta.displayName}
                      </p>
                      {platform === 'instagram' && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 text-amber-400 border-amber-400/40"
                        >
                          Soon
                        </Badge>
                      )}
                    </div>
                    {isConnected ? (
                      <p className="text-xs text-muted-foreground truncate">
                        Connected as{' '}
                        <span className="font-medium text-foreground">
                          {account.username ?? account.platform_user_id}
                        </span>
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">{meta.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {accountsLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : isConnected ? (
                    <>
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 text-green-400 border-green-400/40"
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Connected
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDisconnect(platform)}
                        disabled={isDisconnecting}
                      >
                        {isDisconnecting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Unplug className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5"
                      onClick={() => handleConnect(platform)}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Connect
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
