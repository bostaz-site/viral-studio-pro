# Revue du vendredi — questions ouvertes

> Décisions produit à prendre avec des exemples sous les yeux, pas à chaud. Une ligne par item : date, sujet, contexte, ce qu'il faut pour trancher. Passé en revue chaque vendredi (skill `improve-system`).

## Render

- 2026-09-15 — **Durée minimum après SMART HOOK trim.** Seuil actuel 8 s. Render `79b70746` (Clavicular) : trim 0→38,5 s → clip final 9,4 s. Trop court pour accrocher un algo ? Proposition : 12–15 s min, ou ne pas trimmer si résultat < 12 s. Pour trancher : 4–5 renders trimmés côte à côte + stats des posts publiés par durée.
- 2026-09-15 — **Hook depuis le transcript par défaut.** Le fallback post-Whisper (`d09b513`) ne s'active que si `hook.text` est vide. Render `278fcf92` : hook « CLIP 7 💀 » (titre Twitch recyclé) gardé alors que Whisper avait 38 mots. Proposition : quand Whisper a ≥ 20 mots, regénérer le hook depuis le transcript et le préférer au hook-titre (garder le hook UI si l'utilisateur l'a édité à la main). Pour trancher : comparer 5 hooks titre vs 5 hooks transcript sur les mêmes clips.
- 2026-09-15 — **face-detect.py intermittent.** Plante sur certains clips (render `e7cf778e`), marche sur d'autres (`278fcf92` fullframe 0.83, `79b70746` reaction). Stderr complète maintenant loguée. Pour trancher : attendre 2–3 occurrences avec la stderr, puis fix ciblé.

## Distribution

- 2026-09-15 — **post_stats_tracker TikTok : 13 échecs/15 min.** Attendu tant que `video.list` n'est pas approuvé (`TIKTOK_VIDEO_LIST_APPROVED=false`). Vérifier que le cron ne spamme pas `ai_calls` avec des échecs inutiles : skip TikTok quand le flag est false.

## Cold email

- 2026-09-15 — **Cron `resequence-leads` pas dans cron-job.org.** À ajouter (daily, header `x-api-key`). Premier lead concerné : ~décembre.
- 2026-09-15 — **Microsoft 365 absent de l'offre DFY.** 8 boîtes 100 % Google. Si Google resserre, aucune diversification. Revoir en novembre selon les taux de bounce/réponses.
