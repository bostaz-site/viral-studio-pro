'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Circle, Link2, Wand2, Share2, ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface SetupStep {
  id: string
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  check: () => Promise<boolean>
}

const STORAGE_KEY = 'vsp.setup.dismissed'

export function SetupProgress() {
  const [steps, setSteps] = useState<{ step: SetupStep; done: boolean }[]>([])
  const [dismissed, setDismissed] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY)) return
    } catch {
      return
    }
    setDismissed(false)

    const supabase = createClient()

    const setupSteps: SetupStep[] = [
      {
        id: 'social',
        label: 'Connect a social account',
        description: 'Link TikTok, YouTube, or Instagram',
        icon: Link2,
        href: '/dashboard/distribution',
        check: async () => {
          const { data } = await supabase.from('social_accounts').select('id').limit(1)
          return (data?.length ?? 0) > 0
        },
      },
      {
        id: 'enhance',
        label: 'Enhance your first clip',
        description: 'Make a clip viral with one click',
        icon: Wand2,
        href: '/dashboard',
        check: async () => {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return false
          const { data } = await supabase
            .from('render_jobs')
            .select('id')
            .eq('user_id', user.id)
            .limit(1)
          return (data?.length ?? 0) > 0
        },
      },
      {
        id: 'publish',
        label: 'Schedule or publish a clip',
        description: 'Distribute your content',
        icon: Share2,
        href: '/dashboard/distribution',
        check: async () => {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return false
          const { data } = await supabase
            .from('scheduled_publications')
            .select('id')
            .eq('user_id', user.id)
            .limit(1)
          return (data?.length ?? 0) > 0
        },
      },
    ]

    Promise.all(
      setupSteps.map(async step => ({
        step,
        done: await step.check().catch(() => false),
      }))
    ).then(results => {
      setSteps(results)
      setLoading(false)
      // Auto-dismiss if all done
      if (results.every(r => r.done)) {
        try { window.localStorage.setItem(STORAGE_KEY, '1') } catch {}
        setDismissed(true)
      }
    })
  }, [])

  if (dismissed || loading) return null

  const completedCount = steps.filter(s => s.done).length
  const progress = steps.length > 0 ? (completedCount / steps.length) * 100 : 0

  return (
    <Card className="border-border mb-6">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Complete your setup</p>
            <p className="text-xs text-muted-foreground">{completedCount}/{steps.length} steps done</p>
          </div>
          <button
            onClick={() => {
              setDismissed(true)
              try { window.localStorage.setItem(STORAGE_KEY, '1') } catch {}
            }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Dismiss
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Steps */}
        <div className="space-y-2">
          {steps.map(({ step, done }) => (
            <Link key={step.id} href={step.href}>
              <div className={`flex items-center gap-3 p-2.5 rounded-xl transition-colors ${
                done ? 'opacity-60' : 'hover:bg-muted/30'
              }`}>
                {done ? (
                  <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                    {step.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{step.description}</p>
                </div>
                {!done && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
