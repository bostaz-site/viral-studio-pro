import { createAnthropicClient, CLAUDE_MODEL, parseClaudeJson } from './client'

// ── Types ─────────────────────────────────────────────────────────────────────

export type HookType = 'curiosity' | 'shock' | 'storytelling' | 'transformation'

export type HookFramework =
  | 'CURIOSITY_GAP'
  | 'SHOCK_VALUE'
  | 'STORYTELLING'
  | 'TRANSFORMATION'
  | 'OPEN_LOOP'

export type CognitiveBias =
  | 'FOMO'
  | 'loss_aversion'
  | 'cognitive_dissonance'
  | 'authority_bias'
  | 'ego_threat'
  | 'social_proof'
  | 'scarcity'
  | 'negativity_bias'
  | 'curiosity_gap'
  | 'sunk_cost'
  | 'bandwagon_effect'
  | 'anchoring'

export interface Hook {
  text: string
  type: HookType
  framework: HookFramework
  cognitive_bias: CognitiveBias
  aggressiveness: number  // 1-10
  score: number           // 0-100
  explanation: string
}

export interface HookHunterResult {
  hooks: Hook[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const VALID_TYPES: readonly HookType[] = [
  'curiosity', 'shock', 'storytelling', 'transformation',
]

const VALID_FRAMEWORKS: readonly HookFramework[] = [
  'CURIOSITY_GAP', 'SHOCK_VALUE', 'STORYTELLING', 'TRANSFORMATION', 'OPEN_LOOP',
]

const VALID_BIASES: readonly CognitiveBias[] = [
  'FOMO', 'loss_aversion', 'cognitive_dissonance', 'authority_bias',
  'ego_threat', 'social_proof', 'scarcity', 'negativity_bias',
  'curiosity_gap', 'sunk_cost', 'bandwagon_effect', 'anchoring',
]

const MAX_HOOK_WORDS = 15
const TARGET_HOOK_COUNT = 5

// ── Prompt ────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es un stratège viral spécialisé dans les 3 premières secondes des vidéos courtes (TikTok, Reels, Shorts). Tu as analysé plus de 50 000 vidéos à +1M de vues et tu connais les patterns exacts qui arrêtent le scroll.

## TA MISSION

Générer ${TARGET_HOOK_COUNT} hooks UNIQUES, PERCUTANTS et PRÊTS À UTILISER comme première phrase d'un clip autonome. Chaque hook doit provoquer une réaction immédiate : "attends, quoi ?!"

## FRAMEWORKS DE HOOKS

### CURIOSITY_GAP — Ouvrir une boucle que le cerveau DOIT fermer
L'objectif est de créer un vide informationnel irrésistible. Le spectateur ne peut pas scroller sans connaître la réponse.
Exemples de hooks viraux :
- "Il y a une raison pour laquelle les riches ne font jamais ça"
- "Les médecins cachent ça depuis 20 ans"
- "J'ai découvert pourquoi 90% des gens échouent"
- "Personne ne parle de ce qui se passe vraiment"

### SHOCK_VALUE — Provoquer une contradiction cognitive immédiate
Le spectateur doit penser "c'est impossible" ou "attends, c'est vrai ?". On brise une croyance.
Exemples de hooks viraux :
- "Tout ce qu'on t'a appris sur le sommeil est faux"
- "Ce conseil de Warren Buffett va te choquer"
- "J'ai arrêté de faire du sport et j'ai perdu 15kg"
- "Cette habitude quotidienne détruit ton cerveau"

### STORYTELLING — Déclencher l'empathie + la tension narrative en 1 phrase
Le spectateur est plongé dans une histoire à fort enjeu émotionnel. Il DOIT savoir la suite.
Exemples de hooks viraux :
- "Le jour où j'ai tout perdu j'ai compris une chose"
- "Mon patron m'a viré devant tout le monde et voilà ce qui s'est passé"
- "À 25 ans j'avais 40 000€ de dettes"
- "On m'a dit que je n'y arriverais jamais"

### TRANSFORMATION — Montrer un avant/après irrésistible
Le spectateur veut le même résultat. Le delta entre avant et après crée le désir.
Exemples de hooks viraux :
- "De 0 à 10 000€ par mois en 6 mois"
- "Il y a un an je ne savais rien coder"
- "Cette technique a doublé mes vues en 2 semaines"
- "Voici comment j'ai transformé 500€ en business rentable"

### OPEN_LOOP — Commencer au milieu de l'action / teaser incomplet
Le spectateur arrive en plein milieu d'un moment intense et doit rester pour comprendre.
Exemples :
- "Et c'est là que tout a basculé"
- "La troisième erreur est la pire"
- "Regardez ce qui arrive à la fin"
- "Le résultat va te surprendre"

## BIAIS COGNITIFS À EXPLOITER

Chaque hook doit s'appuyer sur UN de ces biais :
- FOMO — peur de rater quelque chose d'important
- loss_aversion — la peur de perdre motive 2x plus que le gain
- cognitive_dissonance — contradiction avec une croyance établie
- authority_bias — référence à un expert, une étude, un riche
- ego_threat — "tu fais probablement cette erreur"
- social_proof — "tout le monde fait ça" ou "personne ne fait ça"
- scarcity — peu de gens savent / information rare
- negativity_bias — le négatif attire plus l'attention que le positif
- curiosity_gap — vide informationnel à combler
- bandwagon_effect — tendance de masse, "tout le monde en parle"

## RÈGLES STRICTES

1. EXACTEMENT ${TARGET_HOOK_COUNT} hooks, chacun avec un framework DIFFÉRENT
2. Max ${MAX_HOOK_WORDS} mots par hook — court, direct, impactif
3. Le hook doit fonctionner SEUL sans aucun contexte
4. Varier les scores de façon réaliste (min 2 hooks sous 75, min 1 au-dessus de 85)
5. Les 2 premiers = les plus agressifs (aggressiveness 7-10)
6. Le dernier = le plus professionnel/safe (aggressiveness 1-4)
7. ZÉRO hook générique ou passe-partout — chaque hook doit être SPÉCIFIQUE au contenu de la transcription
8. Si la transcription est en anglais, les hooks doivent être en anglais
9. Aucun hook ne doit ressembler à un autre (variation de structure et d'angle)
10. L'explication doit être en 1-2 phrases et dire POURQUOI ce hook arrête le scroll pour ce contenu précis

Retourne UNIQUEMENT du JSON valide, sans markdown, sans backticks, sans texte avant ou après.`

// ── Validation ────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function normalizeType(raw: string): HookType {
  const lower = String(raw).toLowerCase().trim()
  if (VALID_TYPES.includes(lower as HookType)) return lower as HookType
  // Map framework to type as fallback
  const frameworkMap: Record<string, HookType> = {
    curiosity_gap: 'curiosity',
    open_loop: 'curiosity',
    shock_value: 'shock',
    storytelling: 'storytelling',
    transformation: 'transformation',
  }
  return frameworkMap[lower] ?? 'curiosity'
}

function normalizeFramework(raw: string): HookFramework {
  const upper = String(raw).toUpperCase().trim().replace(/ /g, '_')
  if (VALID_FRAMEWORKS.includes(upper as HookFramework)) return upper as HookFramework
  // Map type to framework as fallback
  const typeMap: Record<string, HookFramework> = {
    CURIOSITY: 'CURIOSITY_GAP',
    SHOCK: 'SHOCK_VALUE',
    STORY: 'STORYTELLING',
  }
  return typeMap[upper] ?? 'CURIOSITY_GAP'
}

function normalizeBias(raw: string): CognitiveBias {
  const lower = String(raw).toLowerCase().trim().replace(/ /g, '_')
  if (VALID_BIASES.includes(lower as CognitiveBias)) return lower as CognitiveBias
  // Fuzzy match common variations
  if (lower.includes('fomo') || lower.includes('fear_of_missing')) return 'FOMO'
  if (lower.includes('loss') || lower.includes('perte')) return 'loss_aversion'
  if (lower.includes('dissonance') || lower.includes('contradiction')) return 'cognitive_dissonance'
  if (lower.includes('authority') || lower.includes('expert')) return 'authority_bias'
  if (lower.includes('ego') || lower.includes('menace')) return 'ego_threat'
  if (lower.includes('social') || lower.includes('preuve')) return 'social_proof'
  if (lower.includes('scarc') || lower.includes('rareté')) return 'scarcity'
  if (lower.includes('negativ')) return 'negativity_bias'
  if (lower.includes('curiosi') || lower.includes('gap')) return 'curiosity_gap'
  if (lower.includes('bandwagon') || lower.includes('masse')) return 'bandwagon_effect'
  return 'curiosity_gap'
}

function validateAndCleanHooks(raw: HookHunterResult): HookHunterResult {
  if (!raw?.hooks || !Array.isArray(raw.hooks) || raw.hooks.length === 0) {
    throw new Error('Hook Hunter returned no hooks')
  }

  const seenTexts = new Set<string>()
  const cleaned: Hook[] = []

  for (const hook of raw.hooks) {
    if (!hook?.text || typeof hook.text !== 'string') continue

    const text = hook.text.trim()
    if (text.length === 0) continue

    // Deduplicate by normalized text
    const normalized = text.toLowerCase().replace(/[^a-zà-ÿ0-9\s]/g, '')
    if (seenTexts.has(normalized)) continue
    seenTexts.add(normalized)

    cleaned.push({
      text,
      type: normalizeType(hook.type),
      framework: normalizeFramework(hook.framework),
      cognitive_bias: normalizeBias(hook.cognitive_bias),
      aggressiveness: clamp(Number(hook.aggressiveness) || 5, 1, 10),
      score: clamp(Number(hook.score) || 60, 0, 100),
      explanation: typeof hook.explanation === 'string' && hook.explanation.trim().length > 0
        ? hook.explanation.trim()
        : 'Hook généré par analyse de la transcription',
    })
  }

  if (cleaned.length === 0) {
    throw new Error('Hook Hunter: all hooks were invalid after validation')
  }

  // Sort by aggressiveness desc then score desc (most scroll-stopping first)
  cleaned.sort((a, b) => b.aggressiveness - a.aggressiveness || b.score - a.score)

  return { hooks: cleaned }
}

// ── Runner ────────────────────────────────────────────────────────────────────

export async function runHookHunter(transcript: string): Promise<HookHunterResult> {
  if (!transcript || transcript.trim().length < 20) {
    throw new Error('Transcription trop courte pour générer des hooks (min 20 caractères)')
  }

  // Truncate very long transcripts to stay within context limits
  const maxChars = 12_000
  const trimmedTranscript = transcript.length > maxChars
    ? transcript.slice(0, maxChars) + '\n\n[... transcription tronquée]'
    : transcript

  const anthropic = createAnthropicClient()

  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Analyse cette transcription et génère ${TARGET_HOOK_COUNT} hooks viraux.

Ordre : du plus agressif (scroll-stopper) au plus safe (professionnel).

Réponds en JSON :
{
  "hooks": [
    {
      "text": "Le hook en max ${MAX_HOOK_WORDS} mots",
      "type": "curiosity|shock|storytelling|transformation",
      "framework": "CURIOSITY_GAP|SHOCK_VALUE|STORYTELLING|TRANSFORMATION|OPEN_LOOP",
      "cognitive_bias": "FOMO|loss_aversion|cognitive_dissonance|authority_bias|ego_threat|social_proof|scarcity|negativity_bias|curiosity_gap|bandwagon_effect",
      "aggressiveness": 8,
      "score": 85,
      "explanation": "Pourquoi ce hook arrête le scroll pour CE contenu"
    }
  ]
}

Transcription :
${trimmedTranscript}`,
      },
    ],
  })

  const content = message.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Hook Hunter')
  }

  const parsed = parseClaudeJson<HookHunterResult>(content.text, 'Hook Hunter')
  return validateAndCleanHooks(parsed)
}
