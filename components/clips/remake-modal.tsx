"use client"

import { useState, useCallback } from 'react'
import { Wand2, TrendingUp, Loader2, CheckCircle2, Copy } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { GeneratedClip } from '@/stores/clips-store'

interface AlternativeHook {
  text: string
  type: string
  score: number
  improvement: string
}

interface RemakeResult {
  new_script: string
  alternative_hooks: AlternativeHook[]
  improvement_explanation: string
  potential_score: number
}

interface RemakeModalProps {
  clip: GeneratedClip | null
  open: boolean
  onClose: () => void
}

const HOOK_COLORS: Record<string, string> = {
  curiosity: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  shock: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  storytelling: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  transformation: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
}

function ScoreDelta({ current, potential }: { current: number | null; potential: number }) {
  const delta = potential - (current ?? 0)
  return (
    <div className="flex items-center gap-3">
      <div className="text-center">
        <p className="text-2xl font-black text-foreground">{current ?? '--'}</p>
        <p className="text-xs text-muted-foreground">Score actuel</p>
      </div>
      <TrendingUp className="h-5 w-5 text-green-400" />
      <div className="text-center">
        <p className="text-2xl font-black text-green-400">{potential}</p>
        <p className="text-xs text-muted-foreground">Score potentiel</p>
      </div>
      {delta > 0 && (
        <span className="text-sm font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
          +{delta} pts
        </span>
      )}
    </div>
  )
}

export function RemakeModal({ clip, open, onClose }: RemakeModalProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<RemakeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedScript, setCopiedScript] = useState(false)

  const currentScore = clip?.viral_scores?.[0]?.score ?? null

  const handleGenerate = useCallback(async () => {
    if (!clip) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/remake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clip_id: clip.id }),
      })
      const data = await res.json() as { data: RemakeResult | null; error: string | null; message: string }
      if (!res.ok || !data.data) throw new Error(data.message ?? 'Remake failed')
      setResult(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }, [clip])

  const handleCopyScript = useCallback(() => {
    if (!result) return
    navigator.clipboard.writeText(result.new_script).then(() => {
      setCopiedScript(true)
      setTimeout(() => setCopiedScript(false), 2000)
    })
  }, [result])

  const handleClose = useCallback(() => {
    setResult(null)
    setError(null)
    onClose()
  }, [onClose])

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Remake This — IA"
      description={clip?.title ?? undefined}
      className="max-w-2xl"
    >
      {/* Initial state — no result yet */}
      {!result && !loading && (
        <div className="space-y-4">
          <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">Ce que Claude va faire :</p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">→</span>
                Réécrire le script pour maximiser rétention et viralité
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">→</span>
                Générer 3 hooks alternatifs avec scores comparés
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">→</span>
                Expliquer précisément pourquoi les changements fonctionnent
              </li>
            </ul>
          </div>
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              {error}
            </p>
          )}
          <Button className="w-full gap-2" onClick={handleGenerate}>
            <Wand2 className="h-4 w-4" />
            Générer le Remake
          </Button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Claude analyse et réécrit votre clip…</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Score comparison */}
          <div className="bg-muted/30 border border-border rounded-xl p-4">
            <ScoreDelta current={currentScore} potential={result.potential_score} />
          </div>

          {/* Alternative hooks */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">3 Hooks alternatifs</p>
            {result.alternative_hooks.map((hook, i) => (
              <div
                key={i}
                className="border border-border rounded-xl p-4 space-y-2 bg-card/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-foreground leading-snug flex-1">
                    &ldquo;{hook.text}&rdquo;
                  </p>
                  <span className={cn(
                    'shrink-0 text-xs font-bold px-2 py-0.5 rounded-full border',
                    hook.score >= 70
                      ? 'bg-green-500/15 text-green-400 border-green-500/30'
                      : hook.score >= 40
                      ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                      : 'bg-red-500/15 text-red-400 border-red-500/30'
                  )}>
                    {hook.score}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded-full border capitalize font-medium',
                    HOOK_COLORS[hook.type] ?? 'text-muted-foreground bg-muted border-border'
                  )}>
                    {hook.type}
                  </span>
                  <span className="text-xs text-muted-foreground">{hook.improvement}</span>
                </div>
              </div>
            ))}
          </div>

          {/* New script */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Nouveau script</p>
              <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs" onClick={handleCopyScript}>
                {copiedScript ? (
                  <><CheckCircle2 className="h-3.5 w-3.5 text-green-400" /> Copié</>
                ) : (
                  <><Copy className="h-3.5 w-3.5" /> Copier</>
                )}
              </Button>
            </div>
            <div className="bg-muted/30 border border-border rounded-xl p-4 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
              {result.new_script}
            </div>
          </div>

          {/* Explanation */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Analyse Claude</p>
            <p className="text-sm text-muted-foreground leading-relaxed bg-muted/20 rounded-xl p-4 border border-border">
              {result.improvement_explanation}
            </p>
          </div>

          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => { setResult(null); setError(null) }}
          >
            <Wand2 className="h-4 w-4" />
            Générer une autre version
          </Button>
        </div>
      )}
    </Dialog>
  )
}
