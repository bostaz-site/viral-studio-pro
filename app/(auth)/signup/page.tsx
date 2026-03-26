"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Mail, Lock, User, ArrowRight, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'

export default function SignupPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères')
      return
    }
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)

    // If email confirmation is disabled in Supabase, redirect immediately
    setTimeout(() => router.push('/dashboard'), 2000)
  }

  if (success) {
    return (
      <Card className="bg-card/80 border-border backdrop-blur-sm shadow-xl shadow-black/5">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-7 w-7 text-green-400" />
          </div>
          <div className="space-y-1">
            <p className="text-xl font-bold text-foreground">Compte créé !</p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Vérifiez votre email pour confirmer votre compte, puis connectez-vous pour commencer.
            </p>
          </div>
          <Link href="/login">
            <Button variant="outline" className="mt-2 gap-2">
              Aller à la connexion <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-card/80 border-border backdrop-blur-sm shadow-xl shadow-black/5">
      <CardHeader className="space-y-1 pb-2">
        <h2 className="text-2xl font-bold tracking-tight">Créer votre studio</h2>
        <p className="text-sm text-muted-foreground">Commencez gratuitement — aucune carte bancaire requise</p>
      </CardHeader>
      <form onSubmit={handleSignup}>
        <CardContent className="space-y-4">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2.5 flex items-start gap-2">
              <span className="shrink-0 mt-0.5">!</span>
              <span>{error}</span>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="fullName" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nom complet</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="fullName"
                type="text"
                placeholder="Votre nom"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={loading}
                autoComplete="name"
                className="pl-10 h-11"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="vous@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoComplete="email"
                className="pl-10 h-11"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mot de passe</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="8 caractères minimum"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete="new-password"
                className="pl-10 h-11"
              />
            </div>
          </div>

          {/* Password strength hint */}
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  password.length >= i * 3
                    ? password.length >= 12
                      ? 'bg-green-500'
                      : password.length >= 8
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    : 'bg-muted'
                }`}
              />
            ))}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 pt-2">
          <Button
            type="submit"
            className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-lg shadow-blue-500/20"
            disabled={loading}
          >
            {loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Création...</>
            ) : (
              <>Créer mon compte gratuit <ArrowRight className="ml-2 h-4 w-4" /></>
            )}
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            Déjà un compte ?{' '}
            <Link href="/login" className="text-primary hover:underline font-semibold">
              Se connecter
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
