# 💰 STRATÉGIE FREEMIUM & PAYWALL — Viral Animal

> v1.2 FINALE — 2026-07-02. Validée par 3 votes convergents : recherche multi-agents (~60 sources) + contre-vérification ChatGPT + données marché.
> Contexte : launch TikTok-only, cible 16-25 ans, entité canadienne (Québec).

## ⚡ CORRECTIONS FINALES (contre-vérification ChatGPT)

1. **Le mot "gratuit" — framing officiel** : "Free to start: 3 TikTok-ready clips/month. No card needed." — JAMAIS "free" seul ni "unlimited free". Screenshot-proof. Transparence partout : compteur "render 1 of 3" avant chaque render, "2 free clips left" après. Le bad buzz vient du mur inattendu, pas du mur.
2. **⚠️ Cash App Pay = comptes Stripe US seulement** — nous = Stripe Canada (Viral Animal Inc. QC). À VÉRIFIER avant de compter dessus ; le plan wallets réaliste : **Apple Pay + Google Pay (couvre les 16-17 avec debit ado) + PayPal (18+ seulement)**.
3. **Quota : A/B à prévoir** — "5 clips le premier mois puis 3/mois" vs "3/mois fixe". Le risque du 3 sec : mur avant le wow moment = churn au lieu d'upgrade.
4. **One-time save : 1 SEULE fois LIFETIME**, au premier mur uniquement. Copy : "We'll cover this one so you can finish your clip." Plus jamais réaffiché après.
5. **NOUVEAU : Top-up packs** (monétise ceux qui ne prendront jamais l'abo) : 5 clips extra $5 · 10 clips $9 · remove watermark once $3. Visible SEULEMENT dans le paywall ("Not ready for Pro?"), jamais plus visible que Pro.
6. **Hiérarchie du modal paywall** : Upgrade = bouton primary ("Upgrade & render this clip" — connecte l'achat au désir) / Invite = secondary ("Invite for +3 clips — when they render their first clip", l'activation dite clairement) / Wait = simple text link ("Your free clips reset on {date}"). Titre : "You used your 3 free clips". Annuel PAS dans le premier paywall (après 2-3 renders / settings / cancel flow).
7. **Milestone framing** partout : "You made 3 clips. Unlock 30/month." > "Upgrade to access premium features."
8. **Upsell watermark post-render** : après un render réussi qu'il aime → "Remove watermark for this clip" — plus contextuel que vendre Pro avant la valeur.
9. **Annulation FTC-clean (click-to-cancel)** : 1 question ("pourquoi ?") → 1 offre pertinente (trop cher→pause 30j / pas assez de clips→Studio / qualité→support) → bouton Cancel clair. Jamais 5 écrans, jamais de cancel caché.

## Le modèle

**Freemium sans carte** (pas de trial avec carte — tuerait ~80% des signups sur cette cible).

| Tier | Prix | Quota | Watermark | Note |
|---|---|---|---|---|
| Free | $0 | 3 clips/mois + referrals | Oui | Le watermark = pub gratuite qui tourne sur TikTok |
| Pro | $19/mois | 30 clips/mois | Non | Le tier cible |
| Studio | $24 launch / $29 | 120 clips/mois | Non | Multi-platform quand approuvé |

## La mécanique referral (système bonus_videos DÉJÀ codé)

- Base : 3 clips/mois
- **+2 clips par ami invité, max 3 amis = jusqu'à 9/mois**
- Principe : l'user de 17 ans sans argent ne paie pas — il invite. On transforme les fauchés en canal d'acquisition au lieu de les perdre.

## La séquence paywall (moment du désir maximal)

1. **En continu** : compteur visible "2/3 clips ce mois" (anticipation, zéro surprise)
2. **Au 3e clip** : banner "C'est ton dernier clip gratuit ce mois 🔥"
3. **Au 4e essai** (il a choisi un clip, cliqué Make It Viral — désir chaud) : **MODAL PAYWALL** avec le clip visible derrière :
   - "Ce clip est prêt à devenir viral. Passe Pro pour continuer."
   - 3 chemins : **Upgrade Pro $19** / **Invite un ami (+2 clips)** / "J'attendrai le [date reset]"
   - JAMAIS un message d'erreur gris — un moment de vente stylé (constitution design v2)

⚠️ État actuel du code : le dépassement de quota affiche une ErrorCard (message d'erreur avec lien settings) — à remplacer par le modal (prompt à faire, après design system v2).

## Triggers de conversion secondaires

1. **Watermark** : celui qui poste sérieusement veut son clip propre → Pro
2. **Durée** : 60s max en free
3. **Autofarm** (post-launch) : LA feature Pro/Studio — inutile en free (3 clips), indispensable dès qu'on est sérieux

## Pub & landing

- "Gratuit" assumé dans la pub — mais landing limpide sur ce que free inclut ("3 vidéos/mois · 60s · watermark") = promesse tenue, pas de backlash
- Le référé arrive avec le bonus banner déjà en place (ReferralBonusBanner existe)

## Mesure (events à ajouter au funnel analytics existant)

- `paywall_shown` / `paywall_upgrade_clicked` / `paywall_referral_clicked` / `paywall_dismissed`
- Benchmark santé : paywall_shown → upgrade < 2-3% = problème de pricing ou de moment
- Si le chemin referral explose = boucle virale confirmée

## ✅ TRANCHÉ PAR LA RECHERCHE (v1.1 — 2026-07-02, ~60 sources, RevenueCat 115k apps / Recurly / Visa)

### Les 4 questions ouvertes — réponses
1. **Quota** : 3/mois + referral = OK au launch (aligné Submagic). Le journalier (1/jour) favorise l'habitude (Duolingo +40% rétention D30, pattern Lovable) mais aucun A/B publié — À TESTER en A/B post-launch, pas maintenant.
2. **Soft paywall "one-time save"** : OUI — famille de preuves favorable (reverse trial = +10-40% conversion). Au PREMIER mur seulement : "OK, on t'offre celui-là 🎁 — le prochain sera Pro". Mesurer la cannibalisation.
3. **Annuel** : OUI dès le launch (Pro $190/an ≈ 2 mois gratuits), mais MENSUEL par défaut les 2-3 premiers mois (Gen Z churn-and-return, engagement $180 upfront = gros ask). A/B le défaut annuel plus tard. L'annuel retient 2-3x mieux (RevenueCat).
4. **$19** : VALIDÉ — pile sur le cluster marché (Submagic $19, CapCut Pro $19.99, Veed Lite $19). Pas de .99 (zéro gain documenté), JAMAIS $20 (left-digit).

### Benchmarks de référence
- Free→paid consumer réaliste : **1,5-3%** ; 5%+ = top quartile. Sous 1,5% = problème.
- Paywall contextuel (au moment du désir) : +35% à +81% vs statique — notre séquence est validée.
- Gen Z PAIE (~7 abos, ~$940/an) mais churn vite (63% touchent à leurs abos dans l'année) — le vrai combat = rétention mois 1-2, pas le prix.

### 🎯 2 LEVIERS DÉCOUVERTS (haute priorité)
1. **MOYENS DE PAIEMENT = le déblocage des 16-21 sans carte** : activer Apple Pay + Google Pay + PayPal + Cash App Pay dans Stripe Checkout (46% des Gen Z utilisent Cash App ; 71% préfèrent les wallets ; les 16-17 ont des debit cards ado + Apple Pay). Quasi zéro dev, impact direct. → PROMPT À FAIRE.
2. **WATERMARK OPTIMISÉ (la vraie boucle d'acquisition)** : "@viralanimal" texte lisible + logo, haut-centre 9:16, opacité ~60%, position alternée (anti-crop, comme TikTok) + **end-card 1s "clipped with VIRAL ANIMAL 🐺"** (pattern CapCut — le plus performant du genre). Le nom doit être googlable — la boucle se ferme en trafic direct différé (méthode Loom). PAS de QR code (zéro preuve, dégrade le contenu). + champ "how did you hear about us" au signup pour mesurer.

### ⚠️ CHANGEMENT REQUIS : countdown pricing
Le countdown visible sur la page pricing = risque crédibilité Gen Z (dark pattern, screenshots publics, étude UX : détruit la confiance si reset). REMPLACER par framing "Founding price — $24 garanti tant que tu restes abonné" avec deadline réelle unique, SANS timer.

### Referral — mécanique finale (modèle Suno)
- Two-sided en vidéos : +3 vidéos CHACUN (pas +2) — parrain ET filleul
- **Récompense à l'ACTIVATION du filleul (1er clip RENDU), jamais au signup** — le seuil au render = meilleure anti-fraude (coûte du compute au fraudeur)
- Anti-abus jour 1 : email vérifié + blocage domaines jetables + IP/fingerprint parrain≠filleul + cap 15 vidéos bonus/mois (5 filleuls)
- Au-delà du cap → orienter vers le programme affilié 30% (pipeline déjà buildé)
- Prompt d'invite : APRÈS un render réussi (peak émotionnel, +30% share rate), jamais au signup
- Attentes : 5-15% des users partagent, invité→signup 3-8%. Le referral = +10-20% de croissance, le watermark = le moteur.

### Anti-churn (le vrai combat)
- "Pause plan" dans le flow d'annulation (pattern Recurly)
- Le Free ramène les churned (filet, pas poubelle)
- Leçon StreamLadder : cette cible punit PUBLIQUEMENT les hausses de prix et les modèles à crédits opaques (thread Reddit viral) — jamais de repricing surprise.
