"use client"

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { User, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import type { User as SupabaseUser } from '@supabase/supabase-js'

interface Profile {
  id: string
  email: string
  full_name: string | null
  plan: string | null
}

function SettingsPageInner() {
  const router = useRouter()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [fullName, setFullName] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    setUser(currentUser)
    if (!currentUser) { router.push('/login'); return }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, email, full_name, plan')
      .eq('id', currentUser.id)
      .single()

    setProfile(profileData as Profile | null)
    setFullName(profileData?.full_name ?? currentUser.user_metadata?.full_name ?? '')
    setLoading(false)
  }, [router])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    try {
      const supabase = createClient()
      await supabase.from('profiles').update({ full_name: fullName }).eq('id', user!.id)
      await supabase.auth.updateUser({ data: { full_name: fullName } })
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 2000)
    } finally {
      setSavingProfile(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh] gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-2xl animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Paramètres</h1>
        <p className="text-muted-foreground mt-1">Gérez votre profil.</p>
      </div>

      {/* Profile */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Mon profil</h2>
        </div>
        <Card className="bg-card/50 border-border">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <span className="text-xl font-black text-primary">
                  {(fullName || user?.email || '?')[0].toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{user?.email}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  Plan {profile?.plan ?? 'free'}
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="full-name">Nom complet</Label>
              <div className="flex gap-2">
                <Input
                  id="full-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ton nom"
                  className="flex-1"
                />
                <Button
                  size="sm"
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="gap-1.5"
                >
                  {savingProfile ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : profileSaved ? (
                    <><CheckCircle2 className="h-3.5 w-3.5 text-green-400" /> Sauvé</>
                  ) : (
                    'Sauvegarder'
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-[60vh]" />}>
      <SettingsPageInner />
    </Suspense>
  )
}
