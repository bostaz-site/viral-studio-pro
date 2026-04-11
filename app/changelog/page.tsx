import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles, Zap, Wrench, Gift, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Changelog — ce qu\'on a shippé',
  description:
    'L\'historique public des améliorations de Viral Studio Pro : nouvelles features, fixes, et changements marquants. Mis à jour à chaque release.',
  openGraph: {
    title: 'Changelog — Viral Studio Pro',
    description: 'Ce qu\'on a shippé récemment.',
  },
}

type EntryKind = 'feature' | 'fix' | 'polish' | 'perk'

interface Entry {
  kind: EntryKind
  title: string
  body: string
}

interface Release {
  date: string // ISO yyyy-mm-dd
  label: string
  summary?: string
  entries: Entry[]
}

/**
 * Hand-curated changelog. Each entry is a human translation of one or more
 * git commits — technical details stripped, user impact front-and-center.
 * When shipping new work, add a new release block at the top.
 */
const RELEASES: Release[] = [
  {
    date: '2026-04-10',
    label: 'Semaine Pricing + Conversion',
    summary:
      'Gros ménage sur le pricing et l\'honnêteté marketing, et plusieurs quick-wins conversion sur la landing.',
    entries: [
      {
        kind: 'feature',
        title: 'Nouveau pricing en USD avec bonus Studio',
        body:
          'Free $0 pour 3 clips par mois, Pro $19 pour 30 clips, Studio $24 pour 120 clips (90 baseline + 30 bonus de bienvenue). Les 3 plans incluent maintenant le split-screen automatique.',
      },
      {
        kind: 'feature',
        title: 'Prix de lancement Studio avec countdown vivant',
        body:
          '$24 au lieu de $29 sur Studio jusqu\'au 10 mai. Le countdown affiche le temps restant réel (jours / heures / minutes) sur la landing et la page /pricing — plus de fake urgency.',
      },
      {
        kind: 'feature',
        title: 'Exit-intent popup avec guide gratuit',
        body:
          'Un modal discret propose notre guide PDF "10 hooks viraux qui font x3 sur la rétention TikTok" quand le curseur remonte vers la barre d\'onglets. Téléchargement immédiat, pas de friction.',
      },
      {
        kind: 'feature',
        title: 'Cap 2 minutes par clip + enforcement réel',
        body:
          'La limite de durée par clip est maintenant réellement appliquée côté serveur avant chaque rendu FFmpeg. Fini l\'abus involontaire du quota mensuel.',
      },
      {
        kind: 'fix',
        title: '"Make it viral" sur les clips de la bibliothèque respecte le quota',
        body:
          'Un utilisateur Free pouvait auparavant cliquer "Make it viral" sur des clips trending sans que ça compte dans sa limite mensuelle. Corrigé.',
      },
      {
        kind: 'fix',
        title: 'Free inclut bien le split-screen',
        body:
          'Le split-screen était marketé comme disponible sur tous les plans mais gaté derrière Pro dans le code. Maintenant aligné : tout le monde y a accès, les plans payants élèvent surtout le quota.',
      },
      {
        kind: 'fix',
        title: 'Essai Pro 7 jours réellement livré',
        body:
          'Le checkout Stripe crée maintenant correctement la période d\'essai de 7 jours promise sur la page pricing.',
      },
    ],
  },
  {
    date: '2026-04-09',
    label: 'Semaine Rendu stable + Growth mechanics',
    summary:
      'Stabilisation du pipeline FFmpeg sur Railway et déploiement des mécaniques de croissance (referral + newsletter).',
    entries: [
      {
        kind: 'feature',
        title: 'Dashboard Analytics',
        body:
          'Nouvelle page /analytics avec les stats de rendu, la consommation mensuelle, et l\'activité récente.',
      },
      {
        kind: 'feature',
        title: 'Système de parrainage complet',
        body:
          'Code invite unique par utilisateur, +5 clips bonus pour l\'inviteur et +2 clips pour l\'invité à l\'inscription, bannière de célébration sur le dashboard, et panneau admin /admin/growth pour suivre les conversions.',
      },
      {
        kind: 'feature',
        title: 'Vraie capture d\'emails newsletter',
        body:
          'Le formulaire en pied de landing écrit maintenant dans une vraie table Supabase au lieu du localStorage. Les leads sont visibles dans /admin/growth.',
      },
      {
        kind: 'feature',
        title: 'Render queue avec position par job',
        body:
          'Les rendus longs sont placés dans une file d\'attente et le dashboard montre la position exacte — plus de doute sur "est-ce que ça marche ?".',
      },
      {
        kind: 'fix',
        title: 'Corruption moov atom détectée tôt',
        body:
          'Le VPS valide désormais chaque MP4 téléchargé avec ffprobe avant de lancer FFmpeg, ce qui évite les rendus qui partent en 15 minutes pour finir en erreur.',
      },
      {
        kind: 'fix',
        title: 'Timeout de polling du rendu moins agressif',
        body:
          'L\'éditeur attend plus longtemps avant de déclarer un rendu "échoué" et reprend le suivi automatiquement après un rafraîchissement.',
      },
      {
        kind: 'fix',
        title: 'Clips Twitch résolus en vraie URL signée',
        body:
          'Les URLs de clips Twitch sont maintenant résolues en MP4 direct avec playback access token avant d\'être envoyées au VPS. Fini les "404 video not found".',
      },
    ],
  },
  {
    date: '2026-04-08',
    label: 'Semaine Preset "Make it viral" + Captions',
    summary:
      'Nouveau workflow 1-clic qui applique la configuration optimale sur un clip, et nouveaux styles de sous-titres.',
    entries: [
      {
        kind: 'feature',
        title: 'Bouton "Make it viral" en 1 clic',
        body:
          'Un seul clic applique le preset optimal : split-screen Subway Surfers, sous-titres karaoké Hormozi, reordering du moment fort en premier, et export 9:16.',
      },
      {
        kind: 'feature',
        title: 'Nouveau style de captions Hormozi Purple',
        body:
          'Variante violette alignée avec l\'identité Viral Studio, en plus des styles Hormozi classiques, Word Pop, et Karaoke.',
      },
      {
        kind: 'fix',
        title: 'Reordering du moment fort enfin fiable',
        body:
          'Plusieurs semaines de bugs sur le "moment fort en premier" (timestamps décalés, frames gelées, segments manquants) sont corrigés via une nouvelle approche basée sur concat demuxer plutôt que split/asplit.',
      },
      {
        kind: 'fix',
        title: 'Frame gelée en fin de clip supprimée',
        body:
          'Le bug de 4-5 secondes figées à la fin des clips reorderés est éliminé en probant la vraie durée du stream vidéo avec ffprobe.',
      },
    ],
  },
  {
    date: '2026-04-06',
    label: 'Semaine Sécurité + Architecture',
    summary:
      'Refactor majeur : sécurité, architecture, et amélioration des performances côté serveur.',
    entries: [
      {
        kind: 'polish',
        title: 'Architecture backend consolidée',
        body:
          'Refactor du code serveur avec meilleure séparation des responsabilités, types TypeScript stricts partout, et validation Zod systématique sur les routes API.',
      },
      {
        kind: 'feature',
        title: 'Mode auto-cut audio intelligent',
        body:
          'Nouvelle fonctionnalité qui détecte les silences et les répétitions pour compresser automatiquement un clip long.',
      },
      {
        kind: 'feature',
        title: 'Landing marketing complète',
        body:
          'Hero rewrite, section before/after, comparaison concurrents, témoignages, FAQ structurée, et calculateur ROI interactif.',
      },
    ],
  },
]

const KIND_META: Record<
  EntryKind,
  { label: string; badge: string; icon: typeof Sparkles }
> = {
  feature: {
    label: 'Nouveau',
    badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    icon: Sparkles,
  },
  fix: {
    label: 'Fix',
    badge: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    icon: Wrench,
  },
  polish: {
    label: 'Polish',
    badge: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
    icon: Zap,
  },
  perk: {
    label: 'Bonus',
    badge: 'border-violet-500/30 bg-violet-500/10 text-violet-400',
    icon: Gift,
  },
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z')
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export default function ChangelogPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Changelog — Viral Studio Pro',
    description:
      'Historique public des releases de Viral Studio Pro. Nouvelles features, améliorations et corrections.',
    url: 'https://viral-studio-pro.netlify.app/changelog',
    datePublished: RELEASES[RELEASES.length - 1]?.date,
    dateModified: RELEASES[0]?.date,
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Nav */}
      <header className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="text-xl font-black tracking-tight bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent"
          >
            VIRAL STUDIO
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/pricing">
              <Button variant="ghost" size="sm">
                Tarifs
              </Button>
            </Link>
            <Link href="/login">
              <Button size="sm">Essai gratuit</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-16 pb-10 px-6">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour à l&apos;accueil
          </Link>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 text-xs font-semibold text-primary mb-5">
            <Sparkles className="h-3 w-3" />
            Mise à jour continue
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-[1.1] mb-4">
            Ce qu&apos;on a shippé
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
            Chaque semaine, de nouvelles features et améliorations. L&apos;équipe
            construit Viral Studio Pro en public et toutes les évolutions
            significatives atterrissent ici — pas de vapor, pas de roadmap
            imaginaire.
          </p>
        </div>
      </section>

      {/* Releases */}
      <section className="pb-24 px-6">
        <div className="max-w-4xl mx-auto space-y-14">
          {RELEASES.map((release, index) => (
            <article key={release.date} className="relative">
              {/* Timeline rail (desktop only) */}
              {index < RELEASES.length - 1 && (
                <div
                  aria-hidden
                  className="hidden md:block absolute left-[7px] top-6 bottom-[-56px] w-px bg-border"
                />
              )}

              <div className="md:flex md:gap-6">
                {/* Dot + date */}
                <div className="md:w-44 shrink-0 mb-4 md:mb-0">
                  <div className="flex items-center gap-3 md:block">
                    <div
                      aria-hidden
                      className="md:absolute md:left-0 md:top-1.5 h-3.5 w-3.5 rounded-full bg-primary ring-4 ring-background"
                    />
                    <div className="md:pl-8">
                      <p className="text-sm font-bold text-foreground">
                        {formatDate(release.date)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {release.label}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Entries */}
                <div className="flex-1 space-y-4 md:border-l md:border-border md:pl-6">
                  {release.summary && (
                    <p className="text-sm text-muted-foreground italic">
                      {release.summary}
                    </p>
                  )}
                  <ul className="space-y-4">
                    {release.entries.map((entry, i) => {
                      const meta = KIND_META[entry.kind]
                      const KindIcon = meta.icon
                      return (
                        <li
                          key={i}
                          className="rounded-lg border border-border bg-card/40 p-4 hover:border-primary/30 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${meta.badge}`}
                            >
                              <KindIcon className="h-2.5 w-2.5" />
                              {meta.label}
                            </span>
                            <div className="flex-1 space-y-1">
                              <h3 className="text-sm font-semibold text-foreground">
                                {entry.title}
                              </h3>
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                {entry.body}
                              </p>
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* CTA bottom */}
        <div className="max-w-4xl mx-auto mt-16 rounded-2xl border border-primary/30 bg-gradient-to-br from-blue-500/5 via-indigo-500/5 to-transparent p-8 text-center">
          <h2 className="text-2xl font-bold mb-2">Envie de tester tout ça ?</h2>
          <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
            3 clips par mois offerts, pas de carte bancaire demandée.
          </p>
          <Link href="/login">
            <Button size="lg" className="gap-2">
              Commencer gratuitement
              <Sparkles className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>
            Viral Studio Pro — Transformez vos clips Twitch en vidéos virales
          </p>
          <div className="flex items-center gap-4">
            <Link href="/pricing" className="hover:text-foreground transition-colors">
              Tarifs
            </Link>
            <Link href="/about" className="hover:text-foreground transition-colors">
              À propos
            </Link>
            <Link href="/" className="hover:text-foreground transition-colors">
              Accueil
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
