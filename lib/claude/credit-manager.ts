import { createAnthropicClient, CLAUDE_MODEL, parseClaudeJson } from './client'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreditManagerResult {
  credit_line: string
  credit_description: string
  collaboration_hook: string
  original_link: string
  risk_level: 'low' | 'medium' | 'high'
}

// ── Prompt ────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es un manager de réputation. Le crédit ne doit JAMAIS être caché. Valorise l'auteur original pour transformer une plainte en collaboration.

RÈGLES :
- Rends le crédit visible et flatteur pour l'auteur original
- Formule le crédit comme une recommandation, pas une excuse
- Propose toujours un appel à la collaboration
- Évalue le risque légal (low si contenu éducatif, high si contenu commercial sans autorisation)

Retourne UNIQUEMENT du JSON valide sans markdown ni backticks.`

// ── Runner ────────────────────────────────────────────────────────────────────

export async function runCreditManager(
  authorName: string,
  sourcePlatform: string,
  originalUrl: string
): Promise<CreditManagerResult> {
  const anthropic = createAnthropicClient()

  // Sanitize inputs to prevent prompt injection
  const safeAuthor = authorName.slice(0, 100).replace(/[{}]/g, '')
  const safePlatform = sourcePlatform.slice(0, 50).replace(/[{}]/g, '')
  const safeUrl = originalUrl.slice(0, 500)

  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Génère un crédit professionnel et valorisant pour ce créateur.

Créateur : ${safeAuthor}
Plateforme : ${safePlatform}
URL originale : ${safeUrl}

Réponds en JSON :
{
  "credit_line": "Crédit : @username — contenu original",
  "credit_description": "texte qui valorise le créateur (2 phrases)",
  "collaboration_hook": "phrase qui invite le créateur à collaborer (ex: 'Contacte-moi pour créer ensemble')",
  "original_link": "${safeUrl}",
  "risk_level": "low|medium|high"
}`,
      },
    ],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type from Credit Manager')

  return parseClaudeJson<CreditManagerResult>(content.text, 'Credit Manager')
}
