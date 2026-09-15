# Viral Animal — Vision Produit

Machine à farmer des clips viraux, en 4 étages.

## Étage 1 — Flow Manuel (LIVE)
Browse clips de streamers (Twitch/Kick) → enhance (captions karaoke, hook IA, smart zoom, split-screen) → export/publish vers TikTok, YouTube, Instagram. Premier contact utilisateur.

## Étage 2 — Clip Bank + Autofarm (EN CONSTRUCTION)
L'user met des clips en banque, un agent les publie automatiquement aux moments optimaux. Feature Pro/Studio, cœur de la monétisation. Quality gates, cadence engine, diversification per-render.

## Étage 3 — Live Moment Detection (VISION)
Poll agressif des clips Twitch/Kick, spike de velocity dans les premières minutes = gros moment → notification ou auto-enhance + auto-post AVANT tout le monde.

## Étage 4 — Agent TikTok Personnalisé (VISION)
Agent qui analyse le compte TikTok de l'user pour personnaliser l'autofarm (timing, hashtags, style).

## Réalité du Launch (sept. 2026)

- **TikTok** : Direct Post approved, actif
- **YouTube** : actif (resumable upload, privacy selector)
- **Instagram** : API testée, gated par META_PREVIEW_EMAILS
- **Facebook** : API testée, même gating
- **Plans** : Free ($0, 3 vidéos/mois, watermark), Pro ($19, 30), Studio ($24 launch / $29, 120, multi-platform)
- **Pack accounts** : `profiles.is_comp=true` → Pro gratuit pour testeurs

## Stack

- **Frontend** : Next.js 14 (App Router), TypeScript, Tailwind, shadcn/ui, Zustand
- **Backend** : Supabase (PostgreSQL, ~95 migrations, Storage, Auth, Realtime)
- **VPS** : Railway (FFmpeg, Whisper, face detection, Python/OpenCV)
- **Infra** : Upstash Redis (rate limiting, render queue), Stripe, Instantly, Discord
- **Déploiement** : Netlify (frontend), Railway (VPS) — tous deux auto-deploy sur push master
