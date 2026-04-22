---
name: copywriter-seo
description: "Genere des captions SEO optimisees, des hashtags par plateforme (TikTok, Instagram, YouTube) et une recommandation split-screen a partir d'un clip. Se declenche quand l'utilisateur dit 'genere la caption', 'hashtags', 'SEO reseaux sociaux', 'caption TikTok', 'texte de publication', ou veut publier un clip avec un texte optimise."
---

# Copywriter SEO — Viral Animal

> Position dans le pipeline : Skill 3/4 — s'execute en parallele avec Credit Manager, apres le Clip Cutter. Le champ split_screen est consomme par le Clip Cutter pour le rendu split-screen.

## Objectif
Genere une caption + hashtags OPTIMISES pour chaque plateforme (TikTok, Instagram, YouTube Shorts)
a partir de la transcription d'un clip. Inclut une recommandation de fond split-screen.
Chaque caption est calibree pour l'algorithme specifique de sa plateforme.

## Implementation
- Fichier : `lib/claude/copywriter-seo.ts`
- Client partage : `lib/claude/client.ts`
- Modele : `claude-sonnet-4-6` (via `CLAUDE_MODEL`)
- Max tokens : 3072

## Parametres d'entree

```typescript
runCopywriterSeo(
  clipTranscript: string,
  niche?: string
): Promise<CopywriterSeoResult>
```

- `clipTranscript` : transcription du clip (texte brut)
  - Minimum 20 caracteres (sinon erreur)
  - Tronquee a 10 000 caracteres si trop longue
- `niche` : (optionnel) niche du contenu (ex: "business", "fitness", "tech")

## Constantes

| Constante | Valeur |
|---|---|
| MIN_TRANSCRIPT_CHARS | 20 |
| MAX_TRANSCRIPT_CHARS | 10 000 |

### Limites par plateforme

| Plateforme | Max caption chars | Min hashtags | Max hashtags |
|---|---|---|---|
| TikTok | 300 | 5 | 15 |
| Instagram | 2 200 | 15 | 30 |
| YouTube | 500 | 5 | 15 |

## Types TypeScript

```typescript
type Platform = 'tiktok' | 'instagram' | 'youtube'

interface PlatformCopy {
  caption: string
  hashtags: string[]     // chaque hashtag commence par #, lowercase, sans doublons
}

type SplitScreenBackground = 'sand' | 'slime' | 'parkour' | 'minecraft' | 'cooking'

interface SplitScreenRec {
  recommended_background: SplitScreenBackground
  speed_ratio: number      // 0.3-1.0 (fond plus lent ou egal au clip)
  contrast_reason: string
}

interface CopywriterSeoResult {
  tiktok: PlatformCopy
  instagram: PlatformCopy
  youtube: PlatformCopy
  split_screen: SplitScreenRec
}
```

## Format de sortie JSON

```json
{
  "tiktok": {
    "caption": "Personne ne t'a dit ca sur le sommeil. Follow pour d'autres secrets 🔥",
    "hashtags": ["#sommeil", "#viral", "#fyp", "#pourtoi", "#sante", "#astuce", "#hack"]
  },
  "instagram": {
    "caption": "La plupart des gens dorment mal sans le savoir 😴\n\nVoici les 3 erreurs que tu fais chaque soir ⬇️\n\nLe resultat ? Un sommeil profond des la premiere nuit.\n\n📌 Enregistre pour essayer ce soir\n💬 Dis-moi en commentaire si tu testes",
    "hashtags": ["#sommeil", "#bienetresante", "#routinenuit", "#dormir", "#santementale", "#habitudessaines", "#conseilsante", "#bienetre", "#lifestyle", "#selfcare", "#hygienesommeil", "#repos", "#relaxation", "#health", "#wellness"]
  },
  "youtube": {
    "caption": "3 erreurs qui ruinent ton sommeil chaque soir\n\nDans cette video, decouvre les habitudes qui empechent ton cerveau de se reposer. Des changements simples pour un sommeil profond. 🔔 Abonne-toi pour d'autres astuces sante",
    "hashtags": ["#sommeil", "#sante", "#shorts", "#astuces", "#bienetrequotidien"]
  },
  "split_screen": {
    "recommended_background": "sand",
    "speed_ratio": 0.7,
    "contrast_reason": "Fond sable educatif qui calme le viewer pendant l'explication sur le sommeil"
  }
}
```

## Prompt systeme

### Regles par plateforme

**TikTok** (max 300 chars)
- 1-2 lignes, ultra-court, tutoiement
- Mini-hook DIFFERENT du hook video + CTA fort
- 2-4 emojis strategiques, jamais en debut
- CTA oriente follow/like/comment
- PAS de hashtags dans la caption

**Instagram** (max 2 200 chars)
- 3-6 lignes, micro-storytelling
- Hook fort en ligne 1 (~125 chars visibles avant "...plus")
- CTA save/share (l'algo valorise les saves)
- 3-6 emojis comme separateurs visuels

**YouTube** (max 500 chars)
- Titre SEO (ligne 1, max 70 chars) + 2-3 phrases description
- Keyword principal dans titre ET premiere phrase
- 0-2 emojis, jamais dans le titre
- CTA "Abonne-toi"

### Strategie hashtags 3 tiers

- TIER 1 Viral (20%) : #viral, #fyp, #pourtou
- TIER 2 Mid (50%) : #productivite, #astucesvie
- TIER 3 Niche (30%) : #routinematinale5h, #deepwork

Regles : pas de doublons intra ou inter-plateforme, lowercase, langue adaptee a la transcription,
mix FR + EN si transcription francaise.

### Split-screen

| Fond | Usage |
|---|---|
| sand | Educatif, explications calmes |
| slime | Fun, leger, divertissant |
| parkour | Motivation, fitness, depassement |
| minecraft | Gaming, tech, geek |
| cooking | Lifestyle, bien-etre, ASMR |

## Validations appliquees

### Caption
- Non vide (sinon erreur par plateforme)
- Tronquee a maxCaptionChars si trop longue (avec "...")

### Hashtags
- Normalises : lowercase, sans espaces, prefixe # ajoute si manquant
- Caracteres speciaux supprimes (garde alphanumerique + accents + _)
- Deduplication intra-plateforme (Set)
- Deduplication cross-plateforme (TikTok → Instagram → YouTube, dans cet ordre)
- Tronques a maxHashtags si trop nombreux
- Hashtags "#" seul supprimes

### Split-screen
- Background : valide contre l'enum, fallback `'sand'`
- speed_ratio : clamp [0.3, 1.0], arrondi a 1 decimale, fallback 0.8
- contrast_reason : string non vide, fallback genere automatiquement

## Integration dans le pipeline
1. Clip genere → Copywriter SEO analyse le contenu
2. Les captions sont stockees dans la table `publications` (caption + hashtags)
3. L'utilisateur peut editer avant publication
4. Le Credit Manager injecte le credit si mode curateur
5. Le split_screen est passe au Clip Cutter pour le rendu

## Contraintes
- Toujours retourner les 3 plateformes + split_screen
- Les hashtags doivent etre pertinents a la niche (pas de spam generique)
- La caption TikTok ne doit JAMAIS depasser 300 chars
- Le JSON doit etre valide et parsable directement
- Variable requise : ANTHROPIC_API_KEY
