# PLAN 30 JOURS — Viral Animal · 14 sept → 14 oct 2026

> **Direction : acquisition d'abord, produit en fond.** Rien de nouveau avant 50 users payants, sauf ce qui fait répondre un lead ou poster l'autofarm.
> **Le concret, c'est un mail envoyé à un vrai humain. Premier envoi : jeudi 17 sept.**
> Temps : ≥ 50 % acquisition · ≤ 35 % build · design borné à 2 h/jour. Revue le vendredi.

---

## CE SOIR — dimanche 14 sept

**Email — deux vagues**
- [ ] **Vague 1 (envoi dès jeudi)** : louer 5 boîtes pré-chauffées dans Instantly (Add New → pre-warmed / done-for-you), ~20 $/mois. Régler 10-15/jour/boîte, tracking ouverture OFF, envoi étalé 8h-16h, semaine seulement.
- [ ] **Vague 2 (volume en octobre)** : rebrancher les 12 boîtes Zoho dans Instantly (mot de passe d'application + IMAP + Reconnect) → warm-up ON, 3 semaines.
- [ ] Noter l'échéance de la licence Zoho : ______________

**Permissions — 1-2 semaines de review, à lancer maintenant**
- [ ] TikTok Developer Portal, un seul lot : `video.list` · `user.info.profile` · `user.info.stats` · `comment.list`. Justification : analytics du créateur sur son propre contenu. PAS `comment.list.manage`.
- [ ] Meta : refaire la vidéo App Review (cas d'usage déjà approuvé). Login complet → liste des Pages → sélection d'une Page → usage immédiat → publier un Reel → montrer le Reel publié. UI en anglais, sous-titres.

**Divers**
- [ ] Adresse postale Viral Animal Inc. → footer LCAP (me l'envoyer)
- [ ] cron-job.org : fetch-twitch-clips et rescore-clips actifs ?

---

## SEMAINE 1 — 15 → 21 sept · PREMIERS MAILS

**Lundi-mardi**
- [ ] Claude Code — **prompt cold email** : sync-mailboxes → 3 templates + welcome → séquence Instantly → auto-onboarding « interested » (code affilié + portail + démo, mode review)
- [ ] Choisir les **15 meilleurs des 39 leads** existants
- [ ] Vérifier que le prompt 22 (sound design UI + variante YouTube) est passé

**Mercredi-jeudi**
- [ ] **15 mails à la main**, toi, depuis une boîte pré-chauffée. Personnalisés (nom de la vidéo, le moment précis). C'est le premier concret.
- [ ] Scraper lancé : 39 → 500 leads vérifiés (bounce < 2 %). Cibles : créateurs qui lancent des campagnes Whop/Clipify + streamers Twitch/Kick 1K-20K viewers. Segmenter CA / US, exclure UE-UK.

**Toute la semaine, en fond**
- [ ] Un render à chaque clip qui sort → noter le défaut → item pour le prochain prompt
- [ ] Mettre les clips d'influenceurs en banque → **autofarm poste sur @viralanimal** = test grandeur nature (gate 3/3, à l'heure, widget juste)
- [ ] Sound Design = subtle → vérifier « SFX: N effects placed »
- [ ] Démarrer la **vidéo démo After Effects** (45-60 s : clip brut → hook rouge → captions → zoom → posté)

---

## SEMAINE 2 — 22 → 28 sept · PREMIÈRES RÉPONSES

- [ ] Répondre à chaque réponse **dans l'heure**, depuis la boîte. Onboarding manuel des premiers « yes » (DM ou appel) → livrer les 5 clips en 48 h.
- [ ] Claude Code — **prompt 23** : jitter des heures de post · caption répète le mot-clé du hook · rappel engagement hebdo · i18n restant
- [ ] Séquence Instantly ON sur les leads vérifiés, 50-75/jour (5 boîtes)
- [ ] Vidéo démo AE terminée → mail 2, landing, portail partenaire
- [ ] 1 démo par niche (gaming, IRL, business, fitness) → Video Library
- [ ] Design du site — 2 h/jour max, après le reste

---

## SEMAINE 3 — 29 sept → 5 oct · VOLUME

- [ ] Claude Code — **prompt 24** : cadence 4 paliers (1/j → 2-3 → 4-6 → 6-8, gestion `spam_risk_too_many_posts`) · doubling down (3 variantes d'un post qui performe, flag `video.list`) · mode Campagne (règles Whop dans le gate) · brand-safe (jurons 3 premières s, « ne fait pas mal paraître le streamer ») · preset Creator Rewards ≥ 61 s · multi-compte TikTok
- [ ] 500 leads atteints → séquence à 100-150/jour
- [ ] Auto-onboarding : `review` sur les 20 premiers, puis `auto`
- [ ] 3 témoignages visés

---

## SEMAINE 4 — 6 → 14 oct · ZOHO + REVUE

- [ ] Boîtes Zoho chaudes → les ajouter à la séquence, 10-15/jour chacune → capacité 200+/jour
- [ ] **Si Zoho coupe** : 10 pré-chauffées de plus le jour même ; 2-3 Zoho gardées pour la réception ; le reste non renouvelé à l'échéance
- [ ] A/B après 200 envois : sujet, offre 5 vs 3 clips
- [ ] **Revue du 14 oct** : réponses ? users actifs ? témoignages ? Zoho tient ? autofarm a posté seul ?

---

## APRÈS — octobre-novembre
- **Étage 3 — Live Moment Detection** : la feature qui différencie (« be first »). Dès que l'autofarm est stable 7 jours.
- **UGC inversé** : campagne Whop/Posted (500-1 000 $) — des clippers font « comment je gagne avec Viral Animal », on paie ce qu'on garde, réutilisation en Spark Ads.
- Contenu @viralanimal : « j'ai clippé pour une campagne Whop avec mon outil : X vues, Y $ »
- Viral Animal recommandé dans les Discord de clipping

## HORIZON — après 50 users payants, pas avant
- **Marketplace** : créateurs déposent un budget, clippers produisent avec l'outil, vues comptées via APIs, payout Stripe Connect, 10-20 % de commission. Le vrai plan de scale.
- Génération IA (B-roll, talking head hook) = add-on, pas pivot · Mode Brand / UGC ads

---

## CE QU'ON NE FAIT PAS
Design au-delà de 2 h/jour · comptes achetés, proxies · pivot génération IA · nouvelle feature avant que l'autofarm ait posté seul et que les mails soient partis · attendre que Zoho chauffe pour envoyer

## RÈGLES D'ENVOI (Zoho et pré-chauffé)
10-15/jour/boîte · bounce < 2 % · zéro pixel, zéro image, 1 lien max dès le mail 2 · spintax sur chaque phrase · étalé 8h-16h, semaine · répondre depuis la boîte · attentes : 1-3 % de réponses → 500 leads = 5-15 conversations = 3-5 users

## DATES CLÉS
| Quoi | Quand |
|---|---|
| Pré-chauffées louées · Zoho rebranché · scopes TikTok demandés | dim 14 sept |
| Prompt cold email tourné | mar 16 sept |
| **15 premiers mails à la main** | **jeu 17 sept** |
| Premières réponses attendues | 22-26 sept |
| Vidéo démo AE prête · séquence ON | ~26 sept |
| 500 leads · séquence à 100-150/jour | ~3 oct |
| Zoho rejoint la séquence | ~6 oct |
| Revue | mar 14 oct |
