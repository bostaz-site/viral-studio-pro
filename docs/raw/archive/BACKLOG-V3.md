# BACKLOG V3 — Améliorations futures

Items identifiés par audit architectural. À implémenter quand le projet aura du trafic réel (500+ users).

## Sécurité
- [ ] RLS Supabase explicite sur toutes les tables critiques (render_jobs, videos, social_accounts, account_snapshots, clips_saved, analytics_events, notifications) — Effort : 1 semaine
- [ ] Signature HMAC du payload webhook VPS (au lieu de simple API key header) avec timestamp anti-replay — Effort : 1 jour
- [ ] VPS ne touche plus la DB directement — passe par webhook API authentifié uniquement — Effort : 4h
- [ ] Rate limit granulaire par endpoint sur trending, video-url, status, my-remixes, events — Effort : 4h

## Résilience
- [ ] Fallback DB queue pour render si Redis est down — Effort : 1 semaine
- [ ] Fallback lock DB transactionnel pour token mutex si Redis est down — Effort : 1 jour
- [ ] Mode dégradé explicite si Supabase est down (erreurs claires par flow) — Effort : 1 jour
- [ ] Heartbeat VPS + renew TTL pour les renders longs (>10 min) — Effort : 1 jour
- [ ] Retry backoff durable + dead-letter state pour les jobs render échoués — Effort : 1 jour

## Data Integrity
- [ ] Ledger de quota par job (reserved/consumed/refunded) au lieu du compteur mutable — Effort : 1 semaine
- [ ] Remplacer render:active counter par un Set de job IDs + reconciliation périodique — Effort : 1 semaine
- [ ] Reconciler unique entre render queue Redis, quotas, et render_jobs DB — Effort : 1 jour
- [ ] Statut unifié "expired" dans render_jobs au lieu de done + storage_path=null — Effort : 4h

## Performance
- [ ] Bulk UPDATE SQL (RPC) pour le cron rescore au lieu de N updates parallèles — Effort : 1 jour
- [ ] Endpoint bootstrap pour prefetch (remixes + sparkline + saved + notifications en 1 call) — Effort : 4h
- [ ] Backoff adaptatif sur le polling render (3s → 5s → 10s → 30s) — Effort : 4h

## Coûts
- [ ] Migrer kick-proxy vers Cloudflare Worker (bande passante gratuite) — Effort : 4h
- [ ] Préchargement preview vidéo au hover long seulement (pas au hover court) — Effort : 4h
- [ ] Augmenter le batch interval analytics de 800ms à 2-3s — Effort : 1h
- [ ] Fetch/rescore incrémental par delta au lieu de batch large — Effort : 1 jour

## Produit
- [ ] Micro-preview FFmpeg de 3s quand l'utilisateur change de preset (au lieu de CSS-only preview) — Effort : 1 semaine
- [ ] Normaliser les statuts de publication cross-platform (queued/accepted/failed/published) — Effort : 1 jour
- [ ] Paramètre force=true sur POST /api/render pour forcer un re-render d'un job stuck — Effort : 1h
- [ ] Tests de contrat API Twitch/Kick pour détecter les changements de schéma — Effort : 1 jour
