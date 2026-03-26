import Link from 'next/link'
import { Scissors } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
  description: 'Politique de confidentialité de Viral Studio Pro. Découvrez comment nous protégeons vos données personnelles.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Scissors className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-lg font-black tracking-tight bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
              VIRAL STUDIO
            </span>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold mb-2">Politique de confidentialité</h1>
        <p className="text-sm text-muted-foreground mb-10">Dernière mise à jour : 26 mars 2026</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              Viral Studio Pro (&quot;nous&quot;, &quot;notre&quot;, &quot;nos&quot;) s&apos;engage à protéger votre vie privée. Cette politique de confidentialité explique comment nous collectons, utilisons et protégeons vos informations personnelles lorsque vous utilisez notre service de création de clips viraux.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Données collectées</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">Nous collectons les types de données suivants :</p>
            <ul className="list-disc list-inside space-y-1.5 text-muted-foreground">
              <li><strong className="text-foreground">Informations de compte</strong> : nom, adresse email, mot de passe (chiffré)</li>
              <li><strong className="text-foreground">Contenu uploadé</strong> : vidéos, clips, miniatures que vous uploadez sur la plateforme</li>
              <li><strong className="text-foreground">Données d&apos;utilisation</strong> : fonctionnalités utilisées, clips créés, temps de traitement</li>
              <li><strong className="text-foreground">Données techniques</strong> : adresse IP, type de navigateur, système d&apos;exploitation</li>
              <li><strong className="text-foreground">Données de paiement</strong> : traitées de manière sécurisée par Stripe (nous ne stockons pas vos données bancaires)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. Utilisation des données</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">Vos données sont utilisées pour :</p>
            <ul className="list-disc list-inside space-y-1.5 text-muted-foreground">
              <li>Fournir et améliorer nos services de création de clips</li>
              <li>Traiter vos vidéos (transcription, analyse IA, rendu)</li>
              <li>Gérer votre compte et votre abonnement</li>
              <li>Vous envoyer des notifications relatives au service</li>
              <li>Prévenir la fraude et assurer la sécurité</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Services tiers</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">Nous utilisons les services tiers suivants :</p>
            <ul className="list-disc list-inside space-y-1.5 text-muted-foreground">
              <li><strong className="text-foreground">Supabase</strong> : hébergement de la base de données et stockage des fichiers</li>
              <li><strong className="text-foreground">OpenAI (Whisper)</strong> : transcription audio de vos vidéos</li>
              <li><strong className="text-foreground">Anthropic (Claude)</strong> : analyse IA des clips et génération de scores viraux</li>
              <li><strong className="text-foreground">Stripe</strong> : traitement sécurisé des paiements</li>
              <li><strong className="text-foreground">Netlify</strong> : hébergement de l&apos;application</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Stockage et sécurité</h2>
            <p className="text-muted-foreground leading-relaxed">
              Vos données sont stockées de manière sécurisée via Supabase avec chiffrement au repos et en transit. Les mots de passe sont hashés. Les vidéos uploadées sont stockées dans des buckets privés avec contrôle d&apos;accès par ligne (Row Level Security). Nous ne partageons jamais vos vidéos avec des tiers sans votre consentement explicite.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">6. Vos droits</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">Conformément au RGPD, vous avez le droit de :</p>
            <ul className="list-disc list-inside space-y-1.5 text-muted-foreground">
              <li>Accéder à vos données personnelles</li>
              <li>Rectifier vos données</li>
              <li>Supprimer votre compte et toutes vos données</li>
              <li>Exporter vos données (portabilité)</li>
              <li>Retirer votre consentement à tout moment</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">7. Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              Nous utilisons des cookies essentiels uniquement pour maintenir votre session d&apos;authentification. Nous n&apos;utilisons pas de cookies de tracking publicitaire.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">8. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              Pour toute question relative à cette politique de confidentialité ou pour exercer vos droits, contactez-nous à : <strong className="text-foreground">privacy@viralstudio.pro</strong>
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-border/30 py-8 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-xs text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Viral Studio Pro</p>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-foreground transition-colors">Conditions d&apos;utilisation</Link>
            <Link href="/" className="hover:text-foreground transition-colors">Accueil</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
