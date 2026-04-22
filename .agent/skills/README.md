# Skills — Viral Studio Pro

7 skills IA disponibles dans ce projet :

## Skills principaux (Pipeline de creation de clips)

| # | Skill | Ce qu'il fait | Variable requise |
|---|---|---|---|
| 1 | **hook-hunter** | Genere 5 hooks viraux avec framework, biais cognitif et score | ANTHROPIC_API_KEY |
| 2 | **retention-editor** | Extrait tous les segments viraux avec titre, score et intensite | ANTHROPIC_API_KEY |
| 3 | **copywriter-seo** | Genere caption + hashtags par plateforme + recommandation split-screen | ANTHROPIC_API_KEY |
| 4 | **credit-manager** | Credits par plateforme cible + evaluation du risque (mode curateur) | ANTHROPIC_API_KEY |
| 5 | **clip-cutter** | Orchestre FFmpeg : decoupe, reframe 9:16, sous-titres, watermark | — |

## Skills utilitaires

| # | Skill | Ce qu'il fait | Variable requise |
|---|---|---|---|
| 6 | **description-youtube** | Genere une description YouTube SEO complete | ANTHROPIC_API_KEY |
| 7 | **promouvoir-video** | Cree du contenu promo multi-format (Story + Telegram + Reel) | ANTHROPIC_API_KEY |

## Meta-skill

| Skill | Ce qu'il fait |
|---|---|
| **skill-creator** | Guide maitre pour creer de nouveaux skills |

## Pipeline complet

```
Upload video
  → Whisper (transcription)
    → Hook Hunter (5 hooks viraux)
    → Retention Editor (timestamps de decoupe)
      → Clip Cutter (FFmpeg : rendu video)
        → Copywriter SEO (caption + hashtags)
        → Credit Manager (si mode curateur)
          → Publication
```

## Variables d'environnement

```bash
export ANTHROPIC_API_KEY="..."   # Requis pour tous les skills IA
```

## Scripts standalone

```bash
python3 .agent/skills/description-youtube/scripts/yt_description.py <URL_YOUTUBE>
python3 .agent/skills/promouvoir-video/scripts/promo_video.py <URL_YOUTUBE>
```
