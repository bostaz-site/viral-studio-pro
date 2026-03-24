import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface AlternativeHook {
  text: string
  type: 'curiosity' | 'shock' | 'storytelling' | 'transformation'
  score: number
  improvement: string
}

export interface RemakeScriptResult {
  new_script: string
  alternative_hooks: AlternativeHook[]
  improvement_explanation: string
  potential_score: number
}

export async function runRemakeScript(
  transcript: string,
  currentHook: string | null,
  currentScore: number | null
): Promise<RemakeScriptResult> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `Tu es un expert en création de contenu viral pour les réseaux sociaux.
Voici un clip vidéo avec son script actuel et son score de viralité.

Score actuel : ${currentScore ?? 'Non calculé'}/100
Hook actuel : ${currentHook ?? 'Non identifié'}
Script actuel :
${transcript}

Ta mission :
1. Réécris le script pour maximiser la rétention et la viralité (60-90 secondes max)
2. Génère 3 hooks alternatifs avec scores comparés
3. Explique précisément pourquoi ces changements amélioreront le clip

Réponds en JSON strict :
{
  "new_script": "Nouveau script optimisé...",
  "alternative_hooks": [
    {
      "text": "Hook texte (max 15 mots)",
      "type": "curiosity",
      "score": 92,
      "improvement": "+18 points vs actuel — raison précise"
    }
  ],
  "improvement_explanation": "Explication détaillée des changements et pourquoi ils fonctionnent",
  "potential_score": 88
}`,
      },
    ],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response from Remake Script')

  const jsonMatch = content.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON in Remake Script response')

  return JSON.parse(jsonMatch[0]) as RemakeScriptResult
}
