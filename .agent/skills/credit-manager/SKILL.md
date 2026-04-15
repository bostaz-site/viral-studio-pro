---
name: credit-manager
description: "Genere un credit propre et professionnel pour le createur original d'une video curee, avec credits adaptes par plateforme cible et evaluation du risque. Se declenche quand l'utilisateur dit 'ajoute le credit', 'credit auteur', 'credit createur', 'attribuer la source', ou quand un clip du mode curateur est pret a etre publie."
---

# Credit Manager — Viral Studio Pro

> Position dans le pipeline : Skill 4/4 — s'execute en parallele avec Copywriter SEO, apres le Clip Cutter. Le champ `platform_credits` fournit des credits prets a coller par plateforme cible.

## Objectif
Genere un credit professionnel, visible et flatteur pour le createur original
quand on utilise le mode Curateur de Viral Studio Pro. Le credit est adapte
a chaque plateforme de publication, inclut une evaluation du risque, et propose
une invitation a collaborer.

## Implementation
- Fichier : `lib/claude/credit-manager.ts`
- Client partage : `lib/claude/client.ts`
- Modele : `claude-sonnet-4-6` (via `CLAUDE_MODEL`)
- Max tokens : 1024

## Parametres d'entree

```typescript
runCreditManager(
  authorName: string,
  sourcePlatform: string,
  originalUrl: string
): Promise<CreditManagerResult>
```

- `authorName` : nom du createur original
  - Sanitise : max 100 chars, accolades supprimees
  - Si vide/null → fallback `'Createur inconnu'`
- `sourcePlatform` : plateforme source du contenu
  - Normalise via `normalizeSourcePlatform()` (voir ci-dessous)
- `originalUrl` : URL de la video originale
  - Sanitise : max 500 chars, accolades supprimees
  - Si vide/null → `'Non disponible'` dans le prompt

### Normalisation de la plateforme source

| Input | Normalise en |
|---|---|
| `youtube`, `yt` | `'youtube'` |
| `tiktok`, `tt` | `'tiktok'` |
| `instagram`, `ig`, `insta` | `'instagram'` |
| `twitter`, `x` | `'twitter'` |
| `podcast`, `spotify`, `apple` | `'podcast'` |
| Tout autre | `'unknown'` |

## Types TypeScript

```typescript
type SourcePlatform = 'youtube' | 'tiktok' | 'instagram' | 'twitter' | 'podcast' | 'unknown'

type RiskLevel = 'low' | 'medium' | 'high'

interface PlatformCredit {
  caption_credit: string   // credit pret a coller dans la caption
  hashtag_credit: string   // hashtag lie au credit (ex: #credit)
}

interface CreditManagerResult {
  credit_line: string              // credit court universel (ex: "📹 @user sur TikTok")
  credit_description: string       // texte valorisant le createur (2-3 phrases)
  collaboration_hook: string       // invitation a collaborer
  original_link: string            // URL originale (vide si non disponible)
  risk_level: RiskLevel
  risk_reason: string              // justification du niveau de risque
  platform_credits: {
    tiktok: PlatformCredit
    instagram: PlatformCredit
    youtube: PlatformCredit
  }
}
```

## Format de sortie JSON

```json
{
  "credit_line": "📹 Contenu original : @wolph sur TikTok",
  "credit_description": "Decouvrez le contenu original de @wolph, un createur qui partage des conseils business percutants. Son approche directe et ses resultats concrets en font une reference dans sa niche.",
  "collaboration_hook": "Tu veux qu'on cree du contenu ensemble ? Contacte-nous en DM !",
  "original_link": "https://tiktok.com/@wolph/video/123456",
  "risk_level": "low",
  "risk_reason": "Contenu educatif avec transformation significative du format original",
  "platform_credits": {
    "tiktok": {
      "caption_credit": "📹 Inspiration : @wolph 🔥",
      "hashtag_credit": "#credit"
    },
    "instagram": {
      "caption_credit": "🎬 Contenu original par @wolph — allez decouvrir son profil pour du contenu business de qualite",
      "hashtag_credit": "#creditcreateur"
    },
    "youtube": {
      "caption_credit": "Source : @wolph sur TikTok — https://tiktok.com/@wolph/video/123456",
      "hashtag_credit": "#credit"
    }
  }
}
```

## Prompt systeme

### Philosophie
Le credit n'est JAMAIS un aveu de copie. C'est :
- Une recommandation qui valorise le createur original
- Un signal de professionnalisme
- Une porte d'entree vers une collaboration future
- Une protection legale proactive

### Credits par plateforme cible

| Plateforme | Format | Style | Hashtag |
|---|---|---|---|
| TikTok | Court, decontracte, @mention | "📹 Inspiration : @handle" | #credit |
| Instagram | Plus detaille, storytelling, @mention + tag | "🎬 Contenu original par @handle — ..." | #creditcreateur |
| YouTube | SEO-friendly, dans la description, lien complet | "Source : [Nom] (lien)" | #credit |

### Evaluation du risque

| Niveau | Criteres |
|---|---|
| LOW | Contenu educatif/informatif, fair use probable, petit createur |
| MEDIUM | Contenu divertissant, audience significative, transformation partielle |
| HIGH | Contenu commercial, createur majeur/verifie, peu de transformation, musique protegee |

### Edge cases geres dans le prompt

- Createur inconnu → credit generique base sur la plateforme source
- Handle manquant → nom complet + plateforme ("John Doe sur YouTube")
- URL manquante → note dans le prompt pour ne pas inventer de faux lien
- Plateforme source ≠ plateforme cible → adapte le format

## Validations appliquees

| Champ | Validation | Fallback |
|---|---|---|
| credit_line | String non vide | `'📹 {authorName} sur {platform}'` |
| credit_description | String non vide | `'Contenu original par {authorName}...'` |
| collaboration_hook | String non vide | `'Contacte-nous pour collaborer...'` |
| original_link | URL plausible (`https?://...`) preferee depuis l'input | `''` (vide si invalide) |
| risk_level | Valide contre enum | `'medium'` |
| risk_reason | String non vide | Genere selon le risk_level |
| platform_credits.*.caption_credit | String non vide | Copie de credit_line |
| platform_credits.*.hashtag_credit | Lowercase, prefixe # | `'#credit'` |

### Validation de l'URL
- L'URL passee en entree est la source de verite
- Si l'input n'est pas une URL plausible, le modele peut en fournir une
- Si aucune URL plausible → champ vide (`''`)
- Test : `^https?:\/\/.+\..+` et longueur >= 10

## Integration dans le pipeline
1. Mode Curateur : video tendance → download (yt-dlp) → infos auteur extraites
2. Credit Manager genere le credit formate par plateforme cible
3. Le Copywriter SEO peut integrer `platform_credits.{platform}.caption_credit` dans la caption
4. Le credit est injecte automatiquement lors de la publication

## Contraintes
- Toujours crediter le createur original — c'est NON-NEGOCIABLE
- Le credit doit etre VISIBLE (pas cache en fin de description)
- Ne jamais utiliser de formulations negatives ("vole", "copie", "repris")
- Ne jamais inventer de faux liens
- Le JSON doit etre valide et parsable directement
- Variable requise : ANTHROPIC_API_KEY
