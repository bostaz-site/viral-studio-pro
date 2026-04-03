import Link from 'next/link'
import { Scissors } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Conditions d\'utilisation',
  description: 'Conditions générales d\'utilisation de Viral Studio Pro. Règles et modalités d\'utilisation de notre service de création de clips viraux.',
}

export default function TermsPage() {
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
        <h1 className="text-3xl font-bold mb-2">Conditions d&apos;utilisation</h1>
        <p className="text-sm text-muted-foreground mb-10">Dernière mise à jour : 26 mars 2026</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">1. Acceptation des conditions</h2>
            <p className="text-muted-foreground leading-relaxed">
              En utilisant Viral Studio Pro, vous acceptez les présentes conditions d&apos;utilisation. Si vous n&apos;acceptez pas ces conditions, veuillez ne pas utiliser notre service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Description du service</h2>
            <p className="text-muted-foreground leading-relaxed">
              Viral Studio Pro est un outil SaaS qui permet de créer des clips viraux à partir de vidéos de streams. Le service inclut : la transcription automatique, l&apos;analyse IA, l&apos;ajout de sous-titres karaoké, le split-screen avec vidéos satisfaisantes, et l&apos;export optimisé pour les réseaux sociaux.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. Comptes utilisateurs</h2>
            <ul className="list-disc list-inside space-y-1.5 text-muted-foreground">
              <li>Vous devez fournir des informations exactes lors de l&apos;inscription</li>
              <li>Vous êtes responsable de la sécurité de votre compte et mot de passe</li>
              <li>Un compte ne peut être utilisé que par une seule personne</li>
              <li>Vous devez avoir au moins 13 ans pour utiliser le service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Plans et paiements</h2>
            <ul className="list-disc list-inside space-y-1.5 text-muted-foreground">
              <li><strong className="text-foreground">Plan Free</strong> : 3 vidéos par mois, clips jusqu&apos;à 60 secondes, watermark inclus</li>
              <li><strong className="text-foreground">Plan Pro (29€/mois)</strong> : 50 vidéos par mois, sans watermark, branding personnalisé</li>
              <li><strong className="text-foreground">Plan Studio (79€/mois)</strong> : vidéos illimitées, split-screen, distribution multi-plateforme</li>
              <li>Les abonnements sont facturés mensuellement via Stripe</li>
              <li>Vous pouvez annuler à tout moment, l&apos;accès reste actif jusqu&apos;à la fin de la période payée</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Contenu et propriété intellectuelle</h2>
            <ul className="list-disc list-inside space-y-1.5 text-muted-foreground">
              <li>Vous conservez tous les droits sur le contenu que vous uploadez</li>
              <li>Vous nous accordez une licence limitée pour traiter votre contenu (transcription, analyse, rendu)</li>
              <li>Vous êtes responsable du respect des droits d&apos;auteur du contenu que vous clippez</li>
              <li>Les clips créés à partir de streams de tiers doivent respecter les conditions d&apos;utilisation des plateformes sources (Twitch, YouTube)</li>
              <li>Nous vous encourageons à créditer les créateurs originaux</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">6. Utilisation acceptable</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">Vous vous engagez à ne pas :</p>
            <ul className="list-disc list-inside space-y-1.5 text-muted-foreground">
              <li>Utiliser le service pour du contenu illégal, haineux ou trompeur</li>
              <li>Contourner les limitations de votre plan (comptes multiples, etc.)</li>
              <li>Tenter d&apos;accéder aux données d&apos;autres utilisateurs</li>
              <li>Automatiser l&apos;accès au service sans autorisation (scraping, bots)</li>
              <li>Revendre ou redistribuer le service sans autorisation</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">7. Limitation de responsabilité</h2>
            <p className="text-muted-foreground leading-relaxed">
              Viral Studio Pro est fourni &quot;tel quel&quot;. Nous ne garantissons pas que le service sera disponible en permanence ou exempt d&apos;erreurs. Nous ne sommes pas responsables des dommages résultant de l&apos;utilisation ou de l&apos;impossibilité d&apos;utiliser le service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">8. Résiliation</h2>
            <p className="text-muted-foreground leading-relaxed">
              Nous nous réservons le droit de suspendre ou résilier votre compte en cas de violation de ces conditions. Vous pouvez supprimer votre compte à tout moment depuis les paramètres.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">9. Modifications</h2>
            <p className="text-muted-foreground leading-relaxed">
              Nous pouvons modifier ces conditions à tout moment. Les modifications importantes seront notifiées par email. L&apos;utilisation continue du service après modification vaut acceptation des nouvelles conditions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">10. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              Pour toute question relative à ces conditions, contactez-nous à : <strong className="text-foreground">legal@viralstudio.pro</strong>
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-border/30 py-8 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-xs text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Viral Studio Pro</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-foreground transition-colors">Confidentialité</Link>
            <Link href="/" className="hover:text-foreground transition-colors">Accueil</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
