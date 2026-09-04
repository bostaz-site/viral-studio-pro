'use client'

import { useState } from 'react'
import { Shield, ExternalLink, AlertTriangle, Info } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FlaggedAccountModal } from './flagged-account-modal'

/**
 * Settings > Account Health — links to platform check tools,
 * shadowban vs ineligibility explainer, and flagged account protocol.
 */
export function AccountHealthSection() {
  const [showFlaggedModal, setShowFlaggedModal] = useState(false)

  return (
    <>
      <Card className="bg-card/50 border-border">
        <CardContent className="p-5 space-y-5">
          {/* Quick health check links */}
          <div>
            <p className="text-sm font-semibold text-foreground mb-3">Platform health checks</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <a
                href="https://www.tiktok.com/tiktokstudio/content/check"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 rounded-lg border border-border bg-background/40 hover:bg-muted/30 transition-colors text-sm"
              >
                <span className="font-medium text-foreground">TikTok Studio</span>
                <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />
              </a>
              <a
                href="https://www.tiktok.com/tiktokstudio/content/check"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 rounded-lg border border-border bg-background/40 hover:bg-muted/30 transition-colors text-sm"
              >
                <span className="font-medium text-foreground">Content Check</span>
                <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />
              </a>
              <a
                href="https://accountscenter.instagram.com/info_and_permissions/account_status/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 rounded-lg border border-border bg-background/40 hover:bg-muted/30 transition-colors text-sm"
              >
                <span className="font-medium text-foreground">IG Status</span>
                <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />
              </a>
            </div>
          </div>

          {/* Shadowban explainer */}
          <div className="rounded-lg border border-border/60 bg-background/30 p-4 space-y-2">
            <div className="flex items-start gap-2.5">
              <Info className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Low views vs. shadowban</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  <strong className="text-amber-400">&lt; 100 vues</strong> = votre compte est probablement penalise (violation, spam, ou compte trop recent).
                  Verifiez dans TikTok Studio &gt; Account Check.
                </p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  <strong className="text-blue-400">100-1000 vues</strong> = pas de penalite, c&apos;est le contenu qui ne retient pas.
                  Testez un autre style de clip ou une autre niche.
                </p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Le vrai &quot;shadowban&quot; est rare. TikTok n&apos;utilise pas ce mot — ils appellent ca
                  &quot;ineligible a la recommandation&quot; et le montrent dans Account Check.
                </p>
              </div>
            </div>
          </div>

          {/* Flagged account protocol */}
          <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/5 p-3.5">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-400">Compte flagge ?</p>
                <p className="text-[11px] text-muted-foreground">Video supprimee, strike, ou vues a zero</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
              onClick={() => setShowFlaggedModal(true)}
            >
              Voir le protocole
            </Button>
          </div>

          {/* One-time tips */}
          <div className="space-y-1.5 pt-1">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Recommandations</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
              <li>Un seul compte par streamer / niche (TikTok penalise les comptes qui postent le meme contenu)</li>
              <li>Desactiver &quot;Suggerer mon compte aux contacts&quot; dans TikTok &gt; Confidentialite (evite les reports de proches)</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <FlaggedAccountModal
        open={showFlaggedModal}
        onClose={() => setShowFlaggedModal(false)}
      />
    </>
  )
}
