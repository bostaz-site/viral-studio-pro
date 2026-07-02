# 🔬 RECHERCHE — Calibration du score de viralité (preuves & poids)

> Recherche multi-sources (5 agents parallèles, ~70 sources vérifiées), 2026-07-01.
> Objectif : remplacer les poids inventés du Blowup Chance par des poids ancrés dans la preuve.
> Rappel du cadrage : le score est un outil de dopamine directionnellement honnête — pas une prédiction exacte (personne au monde n'en a une, voir section Concurrents).

---

## 1. Classement des facteurs par force de preuve

| Facteur | Verdict | Meilleure preuve |
|---|---|---|
| **Hook (2-3 premières secondes)** | ★★★★★ FORT — le #1 unanime | TikTok officiel : 63% des top ads placent le message <3s ; valeur max de recall à 2s ; MrBeast leak ; unanime chez tous les concurrents |
| **Captions présentes** | ★★★★ FORT | +12% view time (test A/B Facebook), +58% ad recall (TikTok/Lumen), 100+ études académiques sur l'attention |
| **Durée** | ★★★★ FORT (mais surprise, voir §3) | Buffer 2025, 1,1M vidéos : les >60s font +43% de reach vs 30-60s — TikTok favorise le long depuis 2024-2026 |
| **Completion + rewatch = signaux algo dominants** | ★★★★ FORT | Officiel TikTok + leak NYT "Algo 101" + investigation WSJ convergent : watch time/completion/rewatch > shares ≈ comments > likes |
| **Cuts / pacing dense** | ★★★ MOYEN-FORT (mécanisme prouvé, dosage non prouvé) | Orienting response (Lang, Indiana U.) : chaque cut recapture l'attention involontairement. Le "2-4s/cut" = heuristique non validée |
| **Auto-cut silences** | ★★ MOYEN (inférence forte, pas de mesure directe) | Densité de contenu/seconde + chaque jump cut = orienting response |
| **Audio loudness** | ★★ MOYEN (effet technique réel) | TikTok ne normalise pas le loudness → un master plus fort joue plus fort dans le feed. Cible : -10/-12 LUFS, -1 dBTP |
| **Split-screen / sludge** | ★★ MOYEN + ⚠️ RISQUE | Une seule anecdote chiffrée (Bloomberg 2023, "8x watch time" = analytics d'UN créateur). Mécanisme plausible, jamais mesuré à l'échelle. ET : format associé à l'"AI slop" que les plateformes purgent (voir §4) |
| **Emphasis karaoké (mots surlignés)** | ★ FAIBLE | Aucune preuve directe. Indice indirect : pacing texte 5-10 mots/sec = +2.1x awareness (TikTok). Surtout une norme de format |
| **Smart zoom / punch-ins** | ★ FAIBLE | Zéro mesure directe. Justifiable comme "cut à bas coût" (extension de Lang). Convention esthétique |
| **Tag streamer** | — AUCUNE preuve virale | C'est du crédit/branding (important pour la relation streamer), pas un facteur de performance |
| **Bass boost** | ❌ CONTRE-INDIQUÉ | Les hauts-parleurs de téléphone coupent sous 150-200 Hz : le bass boost est inaudible ET gaspille du headroom (réduit le loudness perçu). À désactiver |
| **"85% regardent sans son"** | ❌ MYTHE (sur TikTok) | Donnée Facebook 2016 recyclée. TikTok officiel : 93% sound ON |

## 2. Poids recalibrés (Blowup Chance — lib/enhance/scoring.ts)

Total maintenu ≈ 0.66 (vs 0.69 actuel) pour préserver la mécanique headroom/99.

| Feature | Actuel | Recalibré | Justification |
|---|---|---|---|
| Captions | 0.14 | **0.14** | Meilleure preuve directe — inchangé |
| Hook text | 0.11 | **0.13** | Facteur #1 unanime — renforcé |
| Hook reorder | 0.05 | **0.07** | Moment fort en premier = hook structurel |
| Split-screen | 0.12 | **0.07** | Preuve anecdotique + risque plateforme — était surpondéré |
| Emphasis | 0.08 | **0.06** | Pas de preuve directe, norme de format |
| Tag | 0.08 | **0.04** | Zéro preuve virale (garde sa valeur relationnelle) |
| Smart zoom | 0.05 | **0.03** | Convention esthétique |
| Audio enhance | 0.03 | **0.05** | Loudness = effet technique réel |
| Bass boost | 0.03-0.05 | **0.00** | Contre-productif sur téléphone — retirer des presets |
| Speed ramp | 0.02-0.03 | **0.02** | Aucune donnée dans les deux sens |
| Auto-cut | 0.03 | **0.05** | Inférence forte (densité + orienting response) |

## 3. ⚠️ Découvertes qui contredisent le code actuel

1. **format_score (Browse, clip-scorer.ts) est périmé** : il donne 100 pts à 15-45s et pénalise >60s à 50 pts. Or Buffer (1,1M vidéos, 2025) : les >60s font +43% de reach — TikTok favorise le long depuis le pivot 2024. Correctif : ne plus pénaliser 45-90s (highlight sec = 21-45s reste bon ; moment qui respire = laisser courir).
2. **bassBoost dans les mood presets** (rage/hype) : à retirer — inaudible sur téléphone, coûte du loudness.
3. **loudnorm cible** : viser I=-11 (au lieu du -14 standard streaming) puisque TikTok ne normalise pas — un master plus fort gagne l'attention du scroll. TP=-1.5 inchangé.

## 4. Notes stratégiques (au-delà des poids)

- **Unoriginal content = LE risque de l'autofarm** (enforcement TikTok durci 15 sept. 2025). Officiel : "filters, overlays, edits don't make reused content original". Le gameplay du split-screen ne compte PAS comme édit créatif — ce sont les captions + hook + recadrage + cuts qui portent la défense d'originalité. Watermark/username Twitch visible = signal de détection confirmé. Musique tierce = fingerprinting (le replace-audio du backlog est confirmé prioritaire).
- **Fréquence de post** : le volume paie par la loterie de la queue (Buffer, 11,4M posts : médiane plate ~500 vues, mais p90 ×4 à 11+ posts/sem). 1-3/jour safe, aucun seuil de spam documenté. Pour l'autofarm : chaque post = ticket de loterie.
- **Timing** : second ordre. La récence est un signal officiel, l'heure du jour non. Ne jamais retarder un clip chaud pour attendre "l'heure optimale".
- **Warm-up des comptes neufs** : mythe côté algo, réel côté anti-spam. Compte neuf : profil complet + démarrer à 1/jour + monter progressivement.
- **Opportunité concurrentielle** : TOUS les scores concurrents (OpusClip, quso, Submagic...) sont des LLM-judges content-only, jamais validés, parfois ouvertement truqués (quso plafonne 75-99). Le seul test indépendant : score >75 = ~2,3x les vues en moyenne, mais imprévisible clip par clip. PERSONNE n'intègre de données réelles (velocity, performance du compte). Ton scoring V2 trending le fait déjà — boucler les données de posts réels sur le Blowup Chance ferait de Viral Animal le premier score falsifiable du marché. (Dive Lab post-launch.)
- **Score = dopamine directionnelle** : validé comme norme de l'industrie. L'honnêteté directionnelle (les vrais facteurs pèsent plus) est ce qui te distinguera quand les users compareront leurs résultats réels.

## 6. Contre-vérification (3e vote, ChatGPT — 2026-07-02) : convergence + 4 raffinements

Le cross-check confirme l'ensemble, avec ces nuances intégrées :

1. **Durée gaming ≠ durée plateforme** : le pivot >60s de Buffer est platform-wide, PAS confirmé pour le gaming. Donnée gaming (OpusClip, 159k clips) : 15-60s domine largement. → format_score : 15-45s reste 100, 45-90s remonte à 80 (pas 85) — on réduit la pénalité sans bonus automatique au long. Story/drama peut mériter 60-90s ; highlight sec = 15-45s.
2. **Hook : 2 fenêtres, pas une** : 0-3s = message/moment clair (63% des top ads), 0-6s = 90% de l'impact ad recall. Implication : le hook text doit délivrer sa promesse <3s, et le clip doit prouver sa valeur <6s (le réorder devrait placer le peak ou son teaser dans les 6 premières secondes).
3. **Loudness TikTok : contesté** — la non-normalisation n'est pas confirmée officiellement, les sources se contredisent. Compromis retenu : loudnorm **I=-12** (plus fort que le standard streaming -14, sans extrême), TP=-1.5, priorité absolue = clarté de la voix, pas de distorsion.
4. **Facteurs additionnels validés par TikTok officiel** (à considérer pour une v2 du score) : originality/duplicate risk (FYP évite le contenu dupliqué — pertinent quand plusieurs users Viral Animal exportent le MÊME clip trending : croiser avec export_count/saturation existants), vertical natif 9:16 (+25% de watch-through 6s selon TikTok), commentability/CTA question ("Who was wrong here?" — à intégrer aux templates de captions et au repost kit), break the 4th wall (33% des top VTR ads — argument de plus pour le format réaction des partenaires).

**La question que le score doit poser** (formulation finale retenue) : est-ce que quelqu'un arrête de scroller en <2s, comprend le moment en <6s, reste jusqu'au payoff, et a envie de commenter ?

## 5. Sources principales

TikTok Transparency Center + Newsroom + Creative Center (officiel) · NYT "Algo 101" leak (2021) · WSJ Inside TikTok's Algorithm (2021) · Buffer 1,1M vidéos durée (2025) + 11,4M posts fréquence (2025) · Gernsbacher méta-revue captions (2015, NIH) · Lang orienting response (Indiana U., 1990-2000) · Bloomberg sludge (2023) · Scientific American (2024) · CSUSB thèse sludge (2025) · Annals of Neurosciences (2026) · TikTok Community Guidelines & Originality Policy · docs officielles OpusClip/quso/StreamLadder/Submagic · ScaleReach test 30j OpusClip · MrBeast leaked PDF (2024) · études mastering TikTok LUFS.
(URLs complètes dans les rapports d'agents, disponibles sur demande.)
