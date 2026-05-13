'use client'

import { useEffect, useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export function AiInsightsCard() {
  const [insights, setInsights] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/dashboard/insights')
      .then(r => r.json())
      .then(json => {
        if (json.data?.insights) setInsights(json.data.insights)
      })
      .catch(() => setInsights(['Unable to load insights']))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Card className="border-border bg-gradient-to-br from-purple-500/5 to-blue-500/5">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-foreground">AI Insights</h3>
          <span className="text-[10px] text-muted-foreground ml-auto">Claude Haiku</span>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 py-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-400" />
            <span className="text-xs text-muted-foreground">Generating insights...</span>
          </div>
        ) : (
          <div className="space-y-2">
            {insights.map((insight, i) => (
              <p key={i} className="text-sm text-foreground/90 leading-relaxed">
                {insight}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
