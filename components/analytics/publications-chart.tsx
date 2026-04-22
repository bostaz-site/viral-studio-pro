'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'

interface PublicationsChartProps {
  data: { date: string; count: number }[]
}

export function PublicationsChart({ data }: PublicationsChartProps) {
  const maxCount = Math.max(...data.map(d => d.count), 1)

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <h3 className="text-sm font-semibold text-foreground">Publications (last 7 days)</h3>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] w-full">
          {data.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              No data yet
            </div>
          ) : (
            <div className="flex items-end justify-between gap-2 h-full pt-4 pb-6 relative">
              {/* Y-axis labels */}
              <div className="absolute left-0 top-0 bottom-6 flex flex-col justify-between text-[10px] text-muted-foreground w-6">
                <span>{maxCount}</span>
                <span>{Math.round(maxCount / 2)}</span>
                <span>0</span>
              </div>

              {/* Bars */}
              <div className="flex items-end justify-between gap-2 flex-1 ml-8 h-full">
                {data.map(d => {
                  const height = maxCount > 0 ? (d.count / maxCount) * 100 : 0
                  const label = new Date(d.date).toLocaleDateString('en-US', {
                    weekday: 'short',
                  })

                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {d.count > 0 ? d.count : ''}
                      </span>
                      <div
                        className="w-full max-w-[40px] rounded-t-md bg-primary/80 hover:bg-primary transition-colors min-h-[2px]"
                        style={{ height: `${Math.max(height, 2)}%` }}
                        title={`${d.date}: ${d.count} publications`}
                      />
                      <span className="text-[10px] text-muted-foreground mt-1">
                        {label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
