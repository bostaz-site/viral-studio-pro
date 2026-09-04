'use client'

import { useState, useEffect } from 'react'
import {
  Clock,
  Eye,
  User,
  FileText,
  LayoutList,
  UserPlus,
  CheckCircle2,
  AlertTriangle,
  X,
} from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface WarmupChecklistProps {
  open: boolean
  onClose: () => void
  /** Is the connected TikTok account new (few followers / videos)? */
  isNewAccount: boolean
  /** TikTok username for display */
  username?: string | null
}

interface CheckItem {
  id: string
  icon: React.ElementType
  label: string
  description: string
  color: string
}

const CHECKLIST: CheckItem[] = [
  {
    id: 'wait48h',
    icon: Clock,
    label: 'Attendre 48h avant de poster',
    description: 'Les comptes neufs qui postent immediatement sont marques comme spam. Attends 48h apres la creation.',
    color: 'text-amber-400',
  },
  {
    id: 'scroll',
    icon: Eye,
    label: 'Scroller et interagir dans ta niche',
    description: 'Regarde 20-30 videos dans ta niche, like, commente. TikTok utilise ca pour categoriser ton compte.',
    color: 'text-blue-400',
  },
  {
    id: 'bio',
    icon: FileText,
    label: 'Bio avec 3-5 mots-cles de niche',
    description: 'Ex: "Clips gaming IRL Twitch moments". Aide TikTok a comprendre ton contenu.',
    color: 'text-purple-400',
  },
  {
    id: 'username',
    icon: User,
    label: 'Nom contenant la niche',
    description: 'Un nom comme "apex_moments" ou "twitch_clips_fr" performe mieux qu\'un nom generique.',
    color: 'text-cyan-400',
  },
  {
    id: 'photo',
    icon: UserPlus,
    label: 'Photo de profil',
    description: 'Les comptes sans photo sont penalises par l\'algo. Utilise un logo ou un avatar en rapport avec ta niche.',
    color: 'text-emerald-400',
  },
  {
    id: 'playlists',
    icon: LayoutList,
    label: 'Creer 2-3 playlists par theme',
    description: 'Ex: "Best IRL moments", "Rage clips". Augmente le temps passe sur ton profil.',
    color: 'text-orange-400',
  },
  {
    id: 'follows_test',
    icon: CheckCircle2,
    label: 'Test: tes follows s\'enregistrent-ils ?',
    description: 'Follow 5 comptes dans ta niche. Si TikTok les reset apres 24h, ton compte est limite — contacte le support.',
    color: 'text-pink-400',
  },
]

const STORAGE_KEY = 'warmup-checklist-state'

export function WarmupChecklist({ open, onClose, isNewAccount, username }: WarmupChecklistProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set())

  // Restore checked state from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setChecked(new Set(JSON.parse(stored) as string[]))
      }
    } catch { /* ignore */ }
  }, [])

  const toggle = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }

  const allDone = checked.size === CHECKLIST.length
  const progress = Math.round((checked.size / CHECKLIST.length) * 100)

  if (!open) return null

  return (
    <Dialog open={open} onClose={onClose} title="Warm-up — nouveau compte TikTok">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        {/* Header */}
        {isNewAccount && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-amber-400">
                {username ? `@${username} semble etre un compte recent` : 'Compte recent detecte'}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Les comptes TikTok neufs qui postent trop vite sont penalises.
                Suis cette checklist avant de publier — l&apos;autofarm est en pause automatique.
              </p>
            </div>
          </div>
        )}

        {/* Progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{checked.size}/{CHECKLIST.length} etapes</span>
            <span className="text-xs font-medium text-foreground">{progress}%</span>
          </div>
          <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${allDone ? 'bg-emerald-500' : 'bg-amber-500'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Checklist */}
        <div className="space-y-2">
          {CHECKLIST.map(item => {
            const isDone = checked.has(item.id)
            return (
              <button
                key={item.id}
                onClick={() => toggle(item.id)}
                className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-all text-left ${
                  isDone
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-border bg-card/50 hover:bg-muted/30'
                }`}
              >
                <div className={`shrink-0 mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  isDone ? 'border-emerald-500 bg-emerald-500' : 'border-muted-foreground/40'
                }`}>
                  {isDone && (
                    <svg viewBox="0 0 12 12" className="h-3 w-3 fill-white">
                      <path d="M10.28 2.28L4.5 8.06 1.72 5.28a.75.75 0 00-1.06 1.06l3.5 3.5a.75.75 0 001.06 0l6.5-6.5a.75.75 0 00-1.06-1.06z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${isDone ? 'text-emerald-400 line-through' : 'text-foreground'}`}>
                    {item.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Footer */}
        {allDone && (
          <div className="flex items-center gap-2 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <p className="text-xs text-emerald-400 font-medium">
              Warm-up termine ! Tu peux maintenant publier et activer l&apos;autofarm.
            </p>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            {allDone ? 'Fermer' : 'Plus tard'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
