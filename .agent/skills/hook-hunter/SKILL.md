---
name: hook-hunter
description: "Analyse une transcription video et genere 5 hooks viraux avec framework, biais cognitif, score d'agressivite et score viral. Se declenche quand l'utilisateur dit 'genere des hooks', 'reecris l'accroche', 'hook viral', 'ameliore le hook', ou fournit une transcription a optimiser pour TikTok, Reels ou Shorts."
---

# Hook Hunter — Viral Animal

> Position dans le pipeline : Skill 1/4 — s'execute en parallele avec Retention Editor, juste apres la transcription Whisper.

## Objectif
Analyse la transcription d'un clip video et genere 5 hooks viraux uniques,
chacun associe a un framework viral, un biais cognitif, un score d'agressivite
et un score de potentiel viral. C'est l'edge produit #1 de Viral Animal.

## Implementation
- Fichier : `lib/claude/hook-hunter.ts`
- Client partage : `lib/claude/client.ts`
- Modele : `claude-sonnet-4-6` (via `CLAUDE_MODEL`)
- Max tokens : 2048

## Parametres d'entree

```typescript
runHookHunter(transcript: string): Promise<HookHunterResult>
```

- `transcript` : transcription complete du clip (texte brut)
  - Minimum 20 caracteres (sinon erreur)
  - Tronquee a 12 000 caracteres si trop longue

## Types TypeScript

```typescript
type HookType = 'curiosity' | 'shock' | 'storytelling' | 'transformation'

type HookFramework =
  | 'CURIOSITY_GAP'
  | 'SHOCK_VALUE'
  | 'STORYTELLING'
  | 'TRANSFORMATION'
  | 'OPEN_LOOP'

type CognitiveBias =
  | 'FOMO' | 'loss_aversion' | 'cognitive_dissonance' | 'authority_bias'
  | 'ego_threat' | 'social_proof' | 'scarcity' | 'negativity_bias'
  | 'curiosity_gap' | 'sunk_cost' | 'bandwagon_effect' | 'anchoring'

interface Hook {
  text: string              // max 15 mots
  type: HookType
  framework: HookFramework
  cognitive_bias: CognitiveBias
  aggressiveness: number    // 1-10
  score: number             // 0-100
  explanation: string
}

interface HookHunterResult {
  hooks: Hook[]
}
```

## Format de sortie JSON

```json
{
  "hooks": [
    {
      "text": "Ce que personne ne te dit sur le sommeil",
      "type": "curiosity",
      "framework": "CURIOSITY_GAP",
      "cognitive_bias": "curiosity_gap",
      "aggressiveness": 9,
      "score": 88,
      "explanation": "Ouvre une boucle informationnelle irresistible sur un sujet universel"
    },
    {
      "text": "Tout ce qu'on t'a appris est faux",
      "type": "shock",
      "framework": "SHOCK_VALUE",
      "cognitive_bias": "cognitive_dissonance",
      "aggressiveness": 8,
      "score": 82,
      "explanation": "Contradiction cognitive qui force le viewer a rester pour verifier"
    },
    {
      "text": "Le jour ou j'ai tout perdu j'ai compris",
      "type": "storytelling",
      "framework": "STORYTELLING",
      "cognitive_bias": "loss_aversion",
      "aggressiveness": 6,
      "score": 75,
      "explanation": "Tension narrative forte, le viewer doit connaitre la suite"
    },
    {
      "text": "De 0 a 10 000 en 6 mois",
      "type": "transformation",
      "framework": "TRANSFORMATION",
      "cognitive_bias": "social_proof",
      "aggressiveness": 5,
      "score": 70,
      "explanation": "Le delta avant/apres cree le desir de connaitre la methode"
    },
    {
      "text": "Et c'est la que tout a bascule",
      "type": "curiosity",
      "framework": "OPEN_LOOP",
      "cognitive_bias": "FOMO",
      "aggressiveness": 3,
      "score": 65,
      "explanation": "Hook safe et professionnel, teaser incomplet qui cree la tension"
    }
  ]
}
```

## Prompt systeme

Le prompt demande exactement 5 hooks avec :
- Chacun utilisant un framework DIFFERENT parmi les 5
- Max 15 mots par hook
- Les 2 premiers = les plus agressifs (aggressiveness 7-10)
- Le dernier = le plus safe (aggressiveness 1-4)
- Scores varies (min 2 hooks sous 75, min 1 au-dessus de 85)
- Chaque hook SPECIFIQUE au contenu (jamais generique)
- Langue adaptee a la transcription (FR si FR, EN si EN)

### 5 Frameworks definis dans le prompt

| Framework | Objectif | Exemple |
|---|---|---|
| CURIOSITY_GAP | Vide informationnel irresistible | "Il y a une raison pour laquelle les riches ne font jamais ca" |
| SHOCK_VALUE | Contradiction cognitive immediate | "Tout ce qu'on t'a appris sur le sommeil est faux" |
| STORYTELLING | Empathie + tension narrative en 1 phrase | "Le jour ou j'ai tout perdu j'ai compris une chose" |
| TRANSFORMATION | Avant/apres irresistible | "De 0 a 10 000 par mois en 6 mois" |
| OPEN_LOOP | Commencer au milieu de l'action | "Et c'est la que tout a bascule" |

### 12 Biais cognitifs exploites

FOMO, loss_aversion, cognitive_dissonance, authority_bias, ego_threat,
social_proof, scarcity, negativity_bias, curiosity_gap, sunk_cost,
bandwagon_effect, anchoring

## Validations appliquees

| Champ | Validation | Fallback |
|---|---|---|
| text | Non vide, string | Skip le hook |
| type | Normalise en lowercase, mappe depuis framework si invalide | `'curiosity'` |
| framework | Normalise en uppercase, mappe depuis type si invalide | `'CURIOSITY_GAP'` |
| cognitive_bias | Fuzzy match (inclut variations FR/EN) | `'curiosity_gap'` |
| aggressiveness | Clamp [1, 10] | 5 |
| score | Clamp [0, 100] | 60 |
| explanation | String non vide | `'Hook genere par analyse de la transcription'` |

Post-validation :
- Deduplication par texte normalise (lowercase, sans ponctuation)
- Tri par aggressiveness desc, puis score desc
- Si 0 hooks valides apres nettoyage → erreur

## Integration dans le pipeline
1. Upload video → Whisper transcrit → Hook Hunter analyse → UI affiche les 5 hooks
2. L'utilisateur choisit un hook → le clip est re-decoupe avec le nouveau hook
3. Le bouton "Remake This" declenche Hook Hunter sur le clip selectionne

## Contraintes
- Exactement 5 hooks demandes (peut en retourner moins apres dedup)
- Le JSON doit etre valide et parsable directement
- Peut reformuler le contenu MAIS ne jamais inventer de faux faits
- Variable requise : ANTHROPIC_API_KEY
