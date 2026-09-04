'use client'

import { useState } from 'react'
import {
  AlertTriangle,
  Trash2,
  PauseCircle,
  Clock,
  ShieldCheck,
  MessageSquare,
  CheckCircle2,
} from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface FlaggedAccountModalProps {
  open: boolean
  onClose: () => void
}

const STEPS = [
  {
    icon: Trash2,
    title: 'Supprimer la video flaggee',
    description: 'Va dans ton profil TikTok, supprime la video qui a recu un avertissement ou un strike. Ne la republier pas.',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
  },
  {
    icon: PauseCircle,
    title: 'Pause 48-72h',
    description: 'Ne poste rien pendant 48 a 72 heures. L\'algorithme a besoin de temps pour reinitialiser la confiance.',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    action: 'pause',
  },
  {
    icon: Clock,
    title: '14 jours de contenu propre',
    description: 'Poste du contenu 100% original pendant 14 jours. Pas de repost, pas de contenu tiers non transforme. Les clips Viral Animal avec hook + captions + zoom comptent.',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
  },
  {
    icon: MessageSquare,
    title: 'Faire appel (si strike)',
    description: 'Si tu as recu un strike : TikTok > Notifications > Violation > Appeal. Tu as 80 jours pour faire appel. Ecris en anglais, sois factuel.',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
  },
  {
    icon: ShieldCheck,
    title: 'Verifier le retablissement',
    description: 'Apres 14 jours, poste un clip et surveille les vues dans les 2 premieres heures. > 200 vues = le compte est retabli.',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
  },
]

export function FlaggedAccountModal({ open, onClose }: FlaggedAccountModalProps) {
  const [pausing, setPausing] = useState(false)

  const handlePauseAutofarm = async () => {
    setPausing(true)
    try {
      const res = await fetch('/api/distribution/autofarm-pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours: 72 }),
      })
      if (res.ok) {
        toast.success('Autofarm mis en pause pour 72h')
      } else {
        const json = await res.json().catch(() => ({})) as { error?: string }
        toast.error(json.error || 'Erreur lors de la pause')
      }
    } catch {
      toast.error('Erreur reseau')
    } finally {
      setPausing(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Protocole compte flagge">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <p className="text-sm text-muted-foreground">
          Si ton compte a recu un avertissement, un strike, ou si tes vues sont tombees a zero, suis ce protocole :
        </p>

        <div className="space-y-3">
          {STEPS.map((step, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3.5 rounded-lg border border-border bg-card/50"
            >
              <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${step.bgColor}`}>
                <step.icon className={`h-4 w-4 ${step.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-muted-foreground/60">ETAPE {i + 1}</span>
                </div>
                <p className="text-sm font-semibold text-foreground mt-0.5">{step.title}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{step.description}</p>
                {step.action === 'pause' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 text-xs gap-1.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                    onClick={handlePauseAutofarm}
                    disabled={pausing}
                  >
                    {pausing ? (
                      'Pause en cours...'
                    ) : (
                      <>
                        <PauseCircle className="h-3 w-3" />
                        Mettre l&apos;autofarm en pause 72h
                      </>
                    )}
                  </Button>
                )}
              </div>
              <div className="shrink-0 mt-1">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground/20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Dialog>
  )
}
