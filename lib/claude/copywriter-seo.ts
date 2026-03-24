import { createAnthropicClient, CLAUDE_MODEL, parseClaudeJson } from './client'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PlatformCopy {
  caption: string
  hashtags: string[]
}

export interface SplitScreenRec {
  recommended_background: 'sand' | 'slime' | 'parkour' | 'minecraft' | 'cooking'
  speed_ratio: number  // always <= 1.0 (background slower than main)
  contrast_reason: string
}

export interface CopywriterSeoResult {
  tiktok: PlatformCopy
  instagram: PlatformCopy
  youtube: PlatformCopy
  split_screen: SplitScreenRec
}

// ── Prompt ────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es un copywriter expert en SEO pour les réseaux sociaux.

RÈGLE SPLIT-SCREEN : Le contenu satisfaisant en bas ne doit pas être plus rapide que la vidéo du haut. Il doit servir d'ancrage hypnotique.

Fonds satisfaisants disponibles :
- sand : éducatif, science, business — ancrage calmant
- slime : fun, humour, viral léger — ancrage ludique
- parkour : motivation, sport, mindset — ancrage énergique
- minecraft : gaming, tech, créativité — ancrage de génération Z
- cooking : lifestyle, nourriture, ASMR — ancrage sensoriel

Retourne UNIQUEMENT du JSON valide sans markdown ni backticks.`

// ── Runner ────────────────────────────────────────────────────────────────────

export async function runCopywriterSeo(
  clipTranscript: string,
  niche?: string
): Promise<CopywriterSeoResult> {
  const anthropic = createAnthropicClient()

  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Génère une caption optimisée + hashtags pour ce clip.${niche ? `\nNiche : ${niche}` : ''}

Réponds en JSON :
{
  "tiktok": {
    "caption": "caption avec emojis et CTA, longueur TikTok",
    "hashtags": ["hashtag1", "hashtag2"]
  },
  "instagram": {
    "caption": "caption plus longue avec storytelling",
    "hashtags": ["hashtag1"]
  },
  "youtube": {
    "caption": "titre SEO + description courte",
    "hashtags": ["hashtag1"]
  },
  "split_screen": {
    "recommended_background": "sand|slime|parkour|minecraft|cooking",
    "speed_ratio": 0.8,
    "contrast_reason": "pourquoi ce fond amplifie le message principal"
  }
}

Transcription du clip :
${clipTranscript}`,
      },
    ],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type from Copywriter SEO')

  return parseClaudeJson<CopywriterSeoResult>(content.text, 'Copywriter SEO')
}
