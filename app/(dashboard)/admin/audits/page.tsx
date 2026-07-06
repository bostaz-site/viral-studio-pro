'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { WolfLoader } from '@/components/ui/wolf-loader'
import { AuditsClient } from './audits-client'

export interface Finding {
  id: string
  audit_date: string
  agent_type: string
  persona: string | null
  severity: string
  title: string
  description: string
  location: string | null
  suggested_fix: string | null
  screenshot_url: string | null
  status: string
  related_finding_id: string | null
  cycle_count: number
  last_verified_at: string | null
  created_at: string
  updated_at: string
}

export interface MetricSnapshot {
  id: string
  snapshot_date: string
  metric_name: string
  metric_value: number
  metric_unit: string | null
  context: Record<string, unknown> | null
  created_at: string
}

export default function AuditsPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [findings, setFindings] = useState<Finding[]>([])
  const [metrics, setMetrics] = useState<MetricSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'today' | 'open' | 'history' | 'metrics'>('today')
  const [agentFilter, setAgentFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (!d.isAdmin) { router.push('/dashboard'); return }
        setAuthorized(true)
      })
      .catch(() => router.push('/dashboard'))
  }, [router])

  const loadFindings = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ tab })
      if (agentFilter) params.set('agent', agentFilter)
      if (severityFilter) params.set('severity', severityFilter)

      const res = await fetch(`/api/admin/audits/findings?${params}`, { cache: 'no-store' })
      const json = await res.json()
      if (json.data) setFindings(json.data)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [tab, agentFilter, severityFilter])

  const loadMetrics = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/audits/metrics', { cache: 'no-store' })
      const json = await res.json()
      if (json.data) setMetrics(json.data)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (!authorized) return
    loadFindings()
    if (tab === 'metrics') loadMetrics()
  }, [authorized, tab, loadFindings, loadMetrics])

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/admin/audits/findings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setFindings(prev => prev.map(f => f.id === id ? { ...f, status } : f))
  }

  if (!authorized) {
    return (
      <div className="flex items-center justify-center h-64">
        <WolfLoader variant="spinner" size={24} mode="system" />
      </div>
    )
  }

  return (
    <AuditsClient
      findings={findings}
      metrics={metrics}
      loading={loading}
      tab={tab}
      setTab={setTab}
      agentFilter={agentFilter}
      setAgentFilter={setAgentFilter}
      severityFilter={severityFilter}
      setSeverityFilter={setSeverityFilter}
      updateStatus={updateStatus}
    />
  )
}
