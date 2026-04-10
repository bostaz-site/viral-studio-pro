"use client"

import { ChevronDown } from 'lucide-react'

export const FAQ_ITEMS = [
  {
    q: 'Est-ce que mes cr\u00e9dits vont expirer si je n\'utilise pas l\'outil ?',
    a: 'Non. Tes 90 cr\u00e9dits (= ~30 clips complets) n\'expirent jamais tant que ton compte est actif. Chaque clip co\u00fbte environ 3 cr\u00e9dits. Pas de pression, tu clips \u00e0 ton rythme.',
  },
  {
    q: 'C\'est vraiment diff\u00e9rent d\'OpusClip et Eklipse ?',
    a: 'Oui. On est le seul outil avec le split-screen automatique (Subway Surfers, Minecraft en bas). OpusClip et Eklipse ne le proposent pas. On a aussi le "Remake This" pour s\'inspirer des clips trending et le score viral IA par Claude.',
  },
  {
    q: 'Le split-screen c\'est quoi exactement ? \u00c7a marche vraiment ?',
    a: 'C\'est le format o\u00f9 ton clip de stream est en haut et une vid\u00e9o satisfaisante (Subway Surfers, Minecraft parkour) en bas. Ce format fait x3 sur la r\u00e9tention TikTok car il cr\u00e9e une double stimulation visuelle. C\'est la formule utilis\u00e9e par les plus gros clip channels.',
  },
  {
    q: 'Je peux utiliser mes VODs Twitch ou il faut uploader ?',
    a: 'Les deux. Tu peux parcourir les clips Twitch et YouTube Gaming directement dans l\'app, ou uploader tes propres vid\u00e9os (MP4, MOV, WebM). Le support Kick arrive bient\u00f4t.',
  },
  {
    q: 'Faut-il installer un logiciel ou c\'est dans le navigateur ?',
    a: 'Tout se passe dans ton navigateur. Z\u00e9ro installation, z\u00e9ro logiciel. Tu cr\u00e9es un compte, tu clips, tu exportes. C\'est aussi simple que \u00e7a.',
  },
  {
    q: 'Mes vid\u00e9os sont stock\u00e9es o\u00f9 ? C\'est s\u00e9curis\u00e9 ?',
    a: 'Tes vid\u00e9os sont stock\u00e9es sur des serveurs s\u00e9curis\u00e9s (Supabase / AWS). Personne d\'autre que toi n\'y a acc\u00e8s. Tu peux les supprimer \u00e0 tout moment depuis ton dashboard. On est conforme RGPD.',
  },
  {
    q: 'Combien de temps \u00e7a prend pour g\u00e9n\u00e9rer un clip ?',
    a: 'En g\u00e9n\u00e9ral 30 \u00e0 60 secondes selon la dur\u00e9e du clip et les options activ\u00e9es (sous-titres, split-screen, etc.). Tu re\u00e7ois une preview d\u00e8s que c\'est pr\u00eat.',
  },
  {
    q: 'Je peux annuler mon abonnement quand je veux ?',
    a: 'Oui, en 1 clic depuis tes param\u00e8tres. Pas de contrat, pas d\'engagement. Tu gardes l\'acc\u00e8s jusqu\'\u00e0 la fin de ta p\u00e9riode de facturation.',
  },
]

export function FaqSection() {
  return (
    <section className="py-20 px-6 bg-card/30 border-t border-border/30">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Questions fr&eacute;quentes</h2>
          <p className="text-muted-foreground mt-3 text-lg">Tout ce que tu dois savoir avant de commencer</p>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => (
            <details key={i} className="group rounded-xl border border-border bg-card/60 overflow-hidden">
              <summary className="flex items-center justify-between cursor-pointer px-6 py-4 text-sm font-medium text-foreground hover:bg-muted/30 transition-colors list-none">
                {item.q}
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-4 transition-transform group-open:rotate-180" />
              </summary>
              <div className="px-6 pb-4 text-sm text-muted-foreground leading-relaxed">
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
