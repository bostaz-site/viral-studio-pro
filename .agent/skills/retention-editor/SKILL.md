---
name: retention-editor
description: "Analyse une transcription et identifie tous les segments viraux a extraire, avec titre, score de retention et intensite. Se declenche quand l'utilisateur dit 'ou couper la video', 'segments a garder', 'optimise la retention', 'decoupe intelligente', ou fournit une transcription a analyser pour en faire des clips courts."
---

# Retention Editor — Viral Animal

> Position dans le pipeline : Skill 2/4 — s'execute en parallele avec Hook Hunter, juste apres la transcription Whisper. Les segments sont consommes par le Clip Cutter pour le rendu FFmpeg.

## Objectif
Analyse la transcription d'une video longue et extrait le MAXIMUM de clips viraux autonomes.
Chaque segment a son propre titre, score de retention et intensite emotionnelle.
C'est le cerveau du pipeline de decoupe — il dit a FFmpeg exactement ou couper.

## Implementation
- Fichier : `lib/claude/retention-editor.ts`
- Client partage : `lib/claude/client.ts`
- Modele : `claude-sonnet-4-6` (via `CLAUDE_MODEL`)
- Max tokens : 4096

## Parametres d'entree

```typescript
runRetentionEditor(
  transcript: string,
  videoDurationSeconds: number
): Promise<RetentionEditorResult>
```

- `transcript` : transcription complete (texte brut ou segments)
  - Minimum 50 caracteres (sinon erreur)
  - Tronquee a 15 000 caracteres si trop longue
- `videoDurationSeconds` : duree totale de la video source en secondes
  - Doit etre un nombre fini > 0 (sinon erreur)

## Constantes

| Constante | Valeur | Usage |
|---|---|---|
| MIN_SEGMENT_SECONDS | 15 | Duree minimale d'un segment (hard floor) |
| MAX_SEGMENT_SECONDS | 90 | Duree maximale ideale |
| IDEAL_MIN_SECONDS | 30 | Duree ideale minimum |
| IDEAL_MAX_SECONDS | 60 | Duree ideale maximum |
| MIN_TRANSCRIPT_CHARS | 50 | Longueur minimale de transcription |
| MAX_TRANSCRIPT_CHARS | 15 000 | Troncature si depasse |
| MAX_TITLE_WORDS | 10 | Mots max pour le titre d'un segment |

## Types TypeScript

```typescript
interface SegmentToKeep {
  start: number          // timestamp debut (secondes, 1 decimale)
  end: number            // timestamp fin (secondes, 1 decimale)
  reason: string         // pourquoi garder ce segment
  title: string          // titre viral unique (max 10 mots)
  intensity: number      // 1-10, intensite emotionnelle
  retention_score: number // 0-100, score unique par segment
}

interface CutReason {
  start: number
  end: number
  why_cut: string
}

interface RetentionEditorResult {
  segments_to_keep: SegmentToKeep[]
  suggested_order: number[]        // indices 0-based des segments
  climax_timestamp: number         // timestamp du moment le plus fort
  estimated_retention_score: number // 0-100, score global
  cut_reasons: CutReason[]         // segments coupes avec justification
}
```

## Format de sortie JSON

```json
{
  "segments_to_keep": [
    {
      "start": 5.0,
      "end": 52.3,
      "reason": "Hook fort + revelation principale",
      "title": "Ce que personne ne te dit sur...",
      "intensity": 9,
      "retention_score": 85
    },
    {
      "start": 60.1,
      "end": 115.8,
      "reason": "Transformation emotionnelle",
      "title": "J'ai failli tout abandonner",
      "intensity": 7,
      "retention_score": 72
    },
    {
      "start": 130.0,
      "end": 188.5,
      "reason": "Point cle avec preuve",
      "title": "La technique qui change tout",
      "intensity": 8,
      "retention_score": 78
    }
  ],
  "suggested_order": [0, 2, 1],
  "climax_timestamp": 45.1,
  "estimated_retention_score": 78,
  "cut_reasons": [
    {"start": 0, "end": 5.0, "why_cut": "Intro molle sans valeur immediate"},
    {"start": 52.3, "end": 60.1, "why_cut": "Transition vide"}
  ]
}
```

## Prompt systeme

Le prompt demande :
- Segments entre 15 et 90 secondes (ideal 30-60s)
- Quantite adaptee a la duree : 5 min → 3-5 clips, 10 min → 5-8, 20+ min → 8-12
- Nombre attendu calcule : `max(2, min(12, floor(videoDuration / 45)))`
- Chaque segment AUTONOME (debut + milieu + fin, pas besoin de contexte)
- Chaque segment commence par un moment fort (jamais intro molle)
- Titre UNIQUE et accrocheur par segment (max 10 mots)
- Score de retention UNIQUE par segment (pas le meme pour tous)
- Segments ne doivent PAS se chevaucher
- Timestamps dans [0, videoDurationSeconds]

## Validations appliquees

### Segments

| Champ | Validation | Fallback |
|---|---|---|
| start / end | Nombres finis, positifs, start < end | Skip le segment |
| start / end | Clamp dans [0, videoDurationSeconds] | Borne a la duree video |
| duree | >= 15s (hard floor) | Skip si trop court |
| duree | Si > 135s (1.5x max), tronque a 90s | end = start + 90 |
| title | String non vide, tronque a 10 mots, deduplique | `'Clip N'` |
| reason | String non vide | `'Segment identifie par analyse de retention'` |
| intensity | Round + clamp [1, 10] | 5 |
| retention_score | Round + clamp [0, 100] | 60 |

### Resolution des chevauchements

Quand deux segments se chevauchent :
1. Le segment avec le meilleur `retention_score` est prioritaire
2. L'autre est tronque (start ou end ajuste)
3. Si le segment tronque fait < 15s → il est supprime

### Autres champs

| Champ | Validation | Fallback |
|---|---|---|
| suggested_order | Indices valides, dedupliques, completes si incomplet | Ordre naturel [0, 1, 2, ...] |
| climax_timestamp | Dans [0, videoDuration] | Start du segment le mieux score |
| estimated_retention_score | Round + clamp [0, 100] | 60 |
| cut_reasons | start >= 0, end > start, end <= duration | Filtre les invalides |

Tous les timestamps sont arrondis a 1 decimale.

## Integration dans le pipeline
1. Whisper transcrit → Retention Editor analyse → segments envoyes au Clip Cutter
2. Chaque segment = 1 clip potentiel avec son score
3. Le Clip Cutter consomme `segments_to_keep` et `suggested_order`
4. L'utilisateur peut ajuster manuellement dans la Timeline Editor

## Contraintes
- Clips entre 15 et 90 secondes
- Pas de chevauchement entre segments
- Titre unique par segment
- Le JSON doit etre valide et parsable directement
- Variable requise : ANTHROPIC_API_KEY
