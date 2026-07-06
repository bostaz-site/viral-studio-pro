'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Globe, ShieldCheck, ShieldX, AlertTriangle } from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Domain {
  id: string
  domain: string
  registrar: string | null
  status: string | null
  spf_configured: boolean | null
  dkim_configured: boolean | null
  dmarc_configured: boolean | null
  warmup_started_at: string | null
  expires_at: string | null
  created_at: string
  mailbox_count: number
}

export default function DomainsPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [domains, setDomains] = useState<Domain[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/dashboard'); return }
      fetch('/api/auth/me').then(r => r.json()).then(d => {
        if (!d.isAdmin) { router.push('/dashboard'); return }
        setAuthorized(true)
        setAuthLoading(false)
      }).catch(() => router.push('/dashboard'))
    })
  }, [router])

  const fetchDomains = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/domains')
      const json = await res.json()
      if (json.data) setDomains(json.data)
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (authorized) fetchDomains()
  }, [authorized, fetchDomains])

  if (authLoading || !authorized) {
    return <div className="flex items-center justify-center py-20"><WolfLoader variant="spinner" size={24} mode="amber" /></div>
  }

  const totalDomains = domains.length
  const healthyCount = domains.filter(d => d.spf_configured && d.dkim_configured && d.dmarc_configured).length
  const problemCount = totalDomains - healthyCount

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-amber-500/10 rounded-lg"><Globe className="h-5 w-5 text-amber-400" /></div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Domains</h1>
          <p className="text-sm text-muted-foreground mt-0.5">DNS configuration & warmup status</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total" value={totalDomains} icon={<Globe className="h-4 w-4" />} color="text-cyan-400" />
        <StatCard label="Healthy" value={healthyCount} icon={<ShieldCheck className="h-4 w-4" />} color="text-green-400" />
        <StatCard label="Issues" value={problemCount} icon={<AlertTriangle className="h-4 w-4" />} color="text-red-400" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><WolfLoader variant="spinner" size={20} mode="amber" /></div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {domains.map(d => (
            <Card key={d.id} className="border-border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground font-mono">{d.domain}</h3>
                  {d.status && (
                    <Badge variant="outline" className={`text-[10px] ${d.status === 'active' ? 'text-green-400 border-green-400/40' : d.status === 'warming' ? 'text-amber-400 border-amber-400/40' : 'text-muted-foreground'}`}>
                      {d.status}
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <DnsCheck label="SPF" valid={d.spf_configured} />
                  <DnsCheck label="DKIM" valid={d.dkim_configured} />
                  <DnsCheck label="DMARC" valid={d.dmarc_configured} />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border">
                  <span>{d.mailbox_count} mailbox{d.mailbox_count !== 1 ? 'es' : ''}</span>
                  {d.registrar && <span>{d.registrar}</span>}
                  {d.expires_at && <span>Expires {new Date(d.expires_at).toLocaleDateString()}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
          {domains.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-2 text-center py-8">No domains configured yet</p>
          )}
        </div>
      )}
    </div>
  )
}

function DnsCheck({ label, valid }: { label: string; valid: boolean | null }) {
  return (
    <div className={`rounded-lg border p-2 text-center ${valid ? 'border-green-500/30 bg-green-500/5' : valid === false ? 'border-red-500/30 bg-red-500/5' : 'border-border'}`}>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <div className="mt-0.5">{valid ? <ShieldCheck className="h-4 w-4 text-green-400 mx-auto" /> : valid === false ? <ShieldX className="h-4 w-4 text-red-400 mx-auto" /> : <span className="text-[10px] text-muted-foreground">?</span>}</div>
    </div>
  )
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <Card className="border-border">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2"><div className={color}>{icon}</div><span className="text-xs text-muted-foreground font-medium">{label}</span></div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
      </CardContent>
    </Card>
  )
}
