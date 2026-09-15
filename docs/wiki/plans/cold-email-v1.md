# Cold Email Sequence V1 — Viral Animal (2026-09-14)

> 3 emails / 8 days. Plain text, no HTML, no images, 1 link max (email 2-3 only). Under 90 words each.
> Variables Instantly : {{firstName}} {{channelName}} {{recentVideoTitle}} {{niche}} {{senderName}}
> Offre : 5 clips gratuits cette semaine, zéro engagement. Objectif : réponse, pas clic.

---

## Email 1 — Day 0 · Subject: `{{channelName}} clips`

Hey {{firstName}},

Watched "{{recentVideoTitle}}" — there are at least 3 moments in there that would work as standalone Shorts/TikToks.

I run Viral Animal, a tool that cuts long videos into vertical clips with karaoke captions, a hook, and smart zoom. Takes about 2 minutes per clip.

Want me to make you 5 clips from your last video this week, free? You keep them, no strings.

{{senderName}}
Viral Animal Inc.

---

## Email 2 — Day 3 · Subject: `re: {{channelName}} clips`

{{firstName}}, quick follow-up.

Here's what the output looks like on a {{niche}} clip (45 sec): {{demoVideoUrl}}

Same thing on your footage — 5 clips, this week, free. Just reply "yes" and I'll take it from there.

{{senderName}}

---

## Email 3 — Day 8 · Subject: `re: {{channelName}} clips`

Last one from me, {{firstName}}.

If clipping isn't a priority right now, no worries — I'll leave it here.

If it is: reply with the video you want cut and I'll send 5 clips back within 48h.

{{senderName}}

---

## Footer (all 3 emails — LCAP / CASL required)

```
—
Viral Animal Inc. · [ADRESSE POSTALE — À REMPLIR]
You're receiving this because {{channelName}} is publicly listed as a business/creator channel.
Don't want these? Reply "stop" or unsubscribe here: {{unsubscribeLink}}
```

---

## Règles d'envoi

| Paramètre | Valeur |
|---|---|
| Volume par boîte | 20/jour semaine 1-2 → 30/jour ensuite |
| Fenêtre | 8h-16h heure du lead, jours de semaine |
| Stop séquence | à la 1re réponse (auto Instantly) |
| Bounce max | 3 % → au-delà, pause + re-vérifier la liste |
| Ouverture tracking | OFF (pixel = spam signal) |
| Tracking des clics | OFF sur email 1, ON email 2-3 (lien démo seulement) |
| Domaines | secondaires uniquement, jamais viralanimal.com |

## Réponses → statut CRM (reply-classifier)

| Réponse | Statut | Action |
|---|---|---|
| "yes" / "sure" / envoie une vidéo | `interested` | auto-onboarding (code affilié + portail + démo) |
| question / "how much" | `evaluating` | réponse manuelle admin |
| "no" / "not now" | `declined` | fin, pas de relance 90 j |
| "stop" / "unsubscribe" | `blocked` | suppression_list immédiat |

## À tester en A/B (après 200 envois)

- Subject : `{{channelName}} clips` vs `3 clips in "{{recentVideoTitle}}"`
- Email 1 avec/sans la ligne "Takes about 2 minutes per clip"
- Offre : 5 clips vs 3 clips

## Ce qui manque avant envoi

- [ ] Adresse postale Viral Animal Inc. dans le footer
- [ ] {{demoVideoUrl}} : 1 vidéo démo par niche dans la Video Library (gaming, IRL, business, fitness)
- [ ] Domaines secondaires + boîtes + warm-up 14 jours
- [ ] 500 leads vérifiés
- [ ] Templates chargés dans `email_templates` (3 lignes) + séquence créée dans Instantly
