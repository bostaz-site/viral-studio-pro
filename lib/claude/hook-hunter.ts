import { createAnthropicClient, CLAUDE_MODEL, parseClaudeJson } from './client'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Hook {
  text: string
  type: 'curiosity' | 'shock' | 'storytelling' | 'transformation'
  framework: 'CURIOSITY_GAP' | 'SHOCK_VALUE' | 'STORYTELLING' | 'TRANSFORMATION'
  cognitive_bias: string
  aggressiveness: number  // 1-10
  score: number           // 0-100
  explanation: string
}

export interface HookHunterResult {
  hooks: Hook[]
}

// ── Prompt ────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es un maître du copywriting de manipulation spécialisé en hooks viraux. Tu exploites les biais cognitifs : Curiosité, Peur de manquer (FOMO), Contradiction, Choc.

FRAMEWORK : Pattern Interrupt
- Si la vidéo parle de sport, le hook doit être : 'Le cardio détruit vos muscles'
- Si c'est du business : 'J'ai perdu 100K pour apprendre ça'
- Force l'arrêt du scroll par le choc ou la contradiction

Pour chaque hook, utilise UN de ces frameworks :
1. CURIOSITY_GAP — 'Ce que personne ne te dit sur...'
2. SHOCK_VALUE — Contradiction totale avec les croyances communes
3. STORYTELLING — 'J'ai failli tout perdre quand...'
4. TRANSFORMATION — 'Avant/Après en X jours'

Génère 3 versions de hooks, de la plus agressive à la plus safe.
Retourne UNIQUEMENT du JSON valide sans markdown ni backticks.`

// ── Runner ────────────────────────────────────────────────────────────────────

export async function runHookHunter(transcript: string): Promise<HookHunterResult> {
  const anthropic = createAnthropicClient()

  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Analyse cette transcription et génère 3 hooks viraux (du plus agressif au plus safe).

Réponds en JSON :
{
  "hooks": [
    {
      "text": "max 15 mots",
      "type": "curiosity|shock|storytelling|transformation",
      "framework": "CURIOSITY_GAP|SHOCK_VALUE|STORYTELLING|TRANSFORMATION",
      "cognitive_bias": "ex: FOMO, contradiction cognitive, peur de l'échec",
      "aggressiveness": 8,
      "score": 85,
      "explanation": "Pourquoi ce hook arrête le scroll (2-3 phrases)"
    }
  ]
}

Transcription :
${transcript}`,
      },
    ],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type from Hook Hunter')

  return parseClaudeJson<HookHunterResult>(content.text, 'Hook Hunter')
}
