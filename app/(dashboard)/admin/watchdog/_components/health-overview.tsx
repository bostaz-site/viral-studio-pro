'use client'

import { Webhook, Shield, Users, Activity } from 'lucide-react'

interface HealthOverviewProps {
  counts: { critical: number; important: number; info: number }
  health: { webhooks: string }
}

function statusDot(status: string) {
  if (status === 'healthy') return 'bg-green-500'
  if (status === 'warning') return 'bg-amber-500'
  if (status === 'error') return 'bg-red-500'
  return 'bg-zinc-500'
}

function statusLabel(status: string) {
  if (status === 'healthy') return 'Healthy'
  if (status === 'warning') return 'Warning'
  if (status === 'error') return 'Error'
  return 'Unknown'
}

export function HealthOverview({ counts, health }: HealthOverviewProps) {
  const totalActive = counts.critical + counts.important + counts.info

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total active alerts */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="h-4 w-4 text-zinc-500" />
          <span className="text-xs text-zinc-500">Active Alerts</span>
        </div>
        <span className={`text-2xl font-bold ${totalActive > 0 ? 'text-amber-400' : 'text-green-400'}`}>
          {totalActive}
        </span>
      </div>

      {/* Critical count */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-4 w-4 text-red-500" />
          <span className="text-xs text-zinc-500">Critical</span>
        </div>
        <span className={`text-2xl font-bold ${counts.critical > 0 ? 'text-red-400' : 'text-zinc-400'}`}>
          {counts.critical}
        </span>
      </div>

      {/* Important count */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Users className="h-4 w-4 text-amber-500" />
          <span className="text-xs text-zinc-500">Important</span>
        </div>
        <span className={`text-2xl font-bold ${counts.important > 0 ? 'text-amber-400' : 'text-zinc-400'}`}>
          {counts.important}
        </span>
      </div>

      {/* Webhook health */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Webhook className="h-4 w-4 text-zinc-500" />
          <span className="text-xs text-zinc-500">Webhooks</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${statusDot(health.webhooks)}`} />
          <span className="text-sm text-zinc-300">{statusLabel(health.webhooks)}</span>
        </div>
      </div>
    </div>
  )
}
