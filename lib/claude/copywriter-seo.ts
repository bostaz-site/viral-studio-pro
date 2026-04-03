import { createAnthropicClient, CLAUDE_MODEL, parseClaudeJson } from './client'

// ── Types ─────────────────────────────────────────────────────────────────────

export type Platform = 'tiktok' | 'instagram' | 'youtube'

export interface PlatformCopy {
  caption: string
  hashtags: string[]
}

export type SplitScreenBackground = 'sand' | 'slime' | 'parkour' | 'minecraft' | 'cooking'

export interface SplitScreenRec {
  recommended_background: SplitScreenBackground
  speed_ratio: number  // 0.3–1.0 (background slower than or equal to main)
  contrast_reason: string
}

export interface CopywriterSeoResult {
  tiktok: PlatformCopy
  instagram: PlatformCopy
  youtube: PlatformCopy
  split_screen: SplitScreenRec
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MIN_TRANSCRIPT_CHARS = 20
const MAX_TRANSCRIPT_CHARS = 10_000

const VALID_BACKGROUNDS: readonly SplitScreenBackground[] = [
  'sand', 'slime', 'parkour', 'minecraft', 'cooking',
]

/** Per-platform constraints used for both prompt guidance and validation */
const PLATFORM_RULES: Record<Platform, {
  maxCaptionChars: number
  minHashtags: number
  maxHashtags: number
}> = {
  tiktok: { maxCaptionChars: 300, minHashtags: 5, maxHashtags: 15 },
  instagram: { maxCaptionChars: 2200, minHashtags: 15, maxHashtags: 30 },
  youtube: { maxCaptionChars: 500, minHashtags: 5, maxHashtags: 15 },
}

// ── Prompt ────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es un copywriter viral expert en SEO social. Tu as optimisé les captions de +10 000 vidéos à +1M de vues sur TikTok, Instagram Reels et YouTube Shorts. Tu maîtrises les algorithmes de chaque plateforme.

## MISSION

Générer une caption + hashtags OPTIMISÉS pour chaque plateforme, à partir de la transcription d'un clip vidéo court. Chaque caption doit être UNIQUE et adaptée aux codes spécifiques de sa plateforme.

## RÈGLES PAR PLATEFORME

### TIKTOK (caption max ${PLATFORM_RULES.tiktok.maxCaptionChars} caractères)
- FORMAT : 1-2 lignes max. Ultra-court, percutant, conversationnel.
- TON : Décontracté, direct, comme si tu parlais à un ami. Tutoiement obligatoire.
- STRUCTURE :
  - Ligne 1 : Mini-hook DIFFÉRENT du hook vidéo (question, provocation, ou phrase incomplète)
  - Ligne 2 : CTA fort (ex: "Follow pour la suite 🔥", "Like si t'étais pas au courant")
- EMOJIS : 2-4 emojis stratégiques, jamais en début de caption
- CTA : Orienté follow/like/comment. Exemples : "Enregistre avant que ça disparaisse", "Tag ton pote qui fait ça"
- HASHTAGS : ${PLATFORM_RULES.tiktok.minHashtags}-${PLATFORM_RULES.tiktok.maxHashtags} hashtags. PAS dans la caption, uniquement dans le champ hashtags.
- Exemples de bonnes captions TikTok :
  - "Personne ne t'a dit ça sur le sommeil 💀 Follow pour d'autres secrets"
  - "Cette technique m'a fait gagner 3h par jour et personne en parle 🧠"
  - "POV: tu découvres que tout ce que tu faisais était faux 😭"

### INSTAGRAM REELS (caption max ${PLATFORM_RULES.instagram.maxCaptionChars} caractères)
- FORMAT : 3-6 lignes. Micro-storytelling avec valeur ajoutée.
- TON : Inspirant, éducatif ou storytelling. Plus posé que TikTok mais pas corporate.
- STRUCTURE :
  - Ligne 1 : Hook fort (seuls ~125 premiers caractères visibles avant "...plus")
  - Lignes 2-4 : Développement avec valeur / émotion / insight
  - Ligne 5 : CTA orienté save/share (l'algo Instagram valorise les saves)
  - Ligne 6 : CTA secondaire (follow, commentaire)
- EMOJIS : 3-6 emojis, utilisés comme séparateurs visuels entre les lignes
- CTA : Orienté save/share. Exemples : "📌 Enregistre ce post pour plus tard", "Partage à quelqu'un qui a besoin de voir ça"
- HASHTAGS : ${PLATFORM_RULES.instagram.minHashtags}-${PLATFORM_RULES.instagram.maxHashtags} hashtags.
- Exemples de bonnes captions Instagram :
  - "La plupart des gens passent 4h par jour sur leur téléphone sans s'en rendre compte. 📱\\n\\nVoici les 3 réglages que j'ai changés pour reprendre le contrôle ⬇️\\n\\nLe résultat ? 2h de temps libre en plus, chaque jour.\\n\\n📌 Enregistre pour essayer ce soir\\n💬 Dis-moi en commentaire si tu testes"

### YOUTUBE SHORTS (caption max ${PLATFORM_RULES.youtube.maxCaptionChars} caractères)
- FORMAT : Titre SEO (première ligne) + 2-3 phrases de description.
- TON : Informatif, orienté recherche. Pense comme un moteur de recherche.
- STRUCTURE :
  - Ligne 1 : Titre SEO accrocheur (max 70 caractères) avec keyword principal en début
  - Lignes 2-3 : Description naturelle avec keywords secondaires intégrés organiquement
- EMOJIS : 0-2 max, dans la description uniquement, jamais dans le titre
- CTA : "Abonne-toi pour plus de [niche]", "Active la cloche 🔔"
- HASHTAGS : ${PLATFORM_RULES.youtube.minHashtags}-${PLATFORM_RULES.youtube.maxHashtags} hashtags. Les 3 premiers sont les plus importants (affichés au-dessus du titre).
- SEO : Le keyword principal DOIT apparaître dans le titre ET la première phrase de description
- Exemples de bonnes captions YouTube :
  - "Comment gagner 3h par jour avec cette technique simple\\n\\nDans cette vidéo, je te montre la méthode de productivité que j'utilise depuis 2 ans. Résultat : plus de temps libre et moins de stress. 🔔 Abonne-toi pour d'autres astuces productivité"

## STRATÉGIE HASHTAGS (SEO)

Organise les hashtags en 3 tiers pour chaque plateforme :
- TIER 1 — Viral (gros volume, large audience) : 20% des hashtags. Ex: #viral, #fyp, #pourtoi
- TIER 2 — Mid (volume moyen, audience ciblée) : 50% des hashtags. Ex: #productivite, #astucesvie, #motivation2024
- TIER 3 — Niche (faible volume, ultra-ciblé) : 30% des hashtags. Ex: #routinematinale5h, #deepwork, #habitudessaines

Règles hashtags :
- JAMAIS de hashtag en double (ni intra-plateforme, ni copier-coller entre plateformes)
- Hashtags en minuscules, sans espaces, sans caractères spéciaux
- Adapter la LANGUE des hashtags à la langue de la transcription
- Mélanger hashtags francophones ET anglophones si la transcription est en français
- Chaque hashtag DOIT commencer par # dans le champ hashtags

## SPLIT-SCREEN

Recommande un fond satisfaisant pour le split-screen :
- sand : contenu éducatif, explications calmes
- slime : contenu fun, léger, divertissant
- parkour : contenu motivation, fitness, dépassement de soi
- minecraft : contenu gaming, tech, geek
- cooking : contenu lifestyle, bien-être, ASMR

speed_ratio = vitesse du fond par rapport à la vidéo principale (0.3 à 1.0). Le fond ne doit JAMAIS être plus rapide que la vidéo principale.

## FORMAT DE RÉPONSE

Retourne UNIQUEMENT du JSON valide sans markdown ni backticks.`

// ── Validation ────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function normalizeHashtag(raw: string): string {
  let tag = raw.trim().toLowerCase().replace(/\s+/g, '')
  if (!tag.startsWith('#')) tag = '#' + tag
  // Strip anything that's not alphanumeric, underscore, or #
  tag = tag.replace(/[^#a-zà-ÿ0-9_]/g, '')
  return tag
}

function validatePlatformCopy(
  raw: unknown,
  platform: Platform
): PlatformCopy {
  const rules = PLATFORM_RULES[platform]
  const obj = raw as Record<string, unknown> | null

  // ── Caption ──
  let caption = ''
  if (obj && typeof obj.caption === 'string' && obj.caption.trim().length > 0) {
    caption = obj.caption.trim()
  } else {
    throw new Error(`Copywriter SEO: missing caption for ${platform}`)
  }

  // Truncate if over platform limit
  if (caption.length > rules.maxCaptionChars) {
    caption = caption.slice(0, rules.maxCaptionChars - 1) + '…'
  }

  // ── Hashtags ──
  let hashtags: string[] = []
  if (obj && Array.isArray(obj.hashtags)) {
    const seen = new Set<string>()
    for (const h of obj.hashtags) {
      if (typeof h !== 'string' || h.trim().length === 0) continue
      const normalized = normalizeHashtag(h)
      if (normalized.length <= 1) continue // Just "#"
      if (seen.has(normalized)) continue
      seen.add(normalized)
      hashtags.push(normalized)
    }
  }

  // Enforce min/max
  if (hashtags.length < rules.minHashtags) {
    // Not enough hashtags — keep what we have (better than fabricating)
    // but warn via a softer approach: just keep them
  }
  if (hashtags.length > rules.maxHashtags) {
    hashtags = hashtags.slice(0, rules.maxHashtags)
  }

  return { caption, hashtags }
}

function validateSplitScreen(raw: unknown): SplitScreenRec {
  const obj = raw as Record<string, unknown> | null

  // ── Background ──
  let background: SplitScreenBackground = 'sand'
  if (obj && typeof obj.recommended_background === 'string') {
    const lower = obj.recommended_background.toLowerCase().trim() as SplitScreenBackground
    if (VALID_BACKGROUNDS.includes(lower)) {
      background = lower
    }
  }

  // ── Speed ratio ──
  let speedRatio = 0.8
  if (obj && obj.speed_ratio !== undefined) {
    const n = Number(obj.speed_ratio)
    if (Number.isFinite(n)) {
      speedRatio = clamp(n, 0.3, 1.0)
    }
  }
  // Round to 1 decimal
  speedRatio = Math.round(speedRatio * 10) / 10

  // ── Contrast reason ──
  const contrastReason =
    obj && typeof obj.contrast_reason === 'string' && obj.contrast_reason.trim().length > 0
      ? obj.contrast_reason.trim()
      : `Fond ${background} sélectionné pour contraster avec le contenu principal`

  return {
    recommended_background: background,
    speed_ratio: speedRatio,
    contrast_reason: contrastReason,
  }
}

function validateAndCleanResult(raw: CopywriterSeoResult): CopywriterSeoResult {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Copywriter SEO: invalid response structure')
  }

  const tiktok = validatePlatformCopy(raw.tiktok, 'tiktok')
  const instagram = validatePlatformCopy(raw.instagram, 'instagram')
  const youtube = validatePlatformCopy(raw.youtube, 'youtube')
  const splitScreen = validateSplitScreen(raw.split_screen)

  // ── Cross-platform hashtag dedup ──
  // Each platform should have unique hashtags; remove any that appear in a prior platform
  const globalSeen = new Set<string>()

  function dedup(copy: PlatformCopy): PlatformCopy {
    const unique = copy.hashtags.filter((h) => {
      if (globalSeen.has(h)) return false
      globalSeen.add(h)
      return true
    })
    return { ...copy, hashtags: unique }
  }

  return {
    tiktok: dedup(tiktok),
    instagram: dedup(instagram),
    youtube: dedup(youtube),
    split_screen: splitScreen,
  }
}

// ── Runner ────────────────────────────────────────────────────────────────────

export async function runCopywriterSeo(
  clipTranscript: string,
  niche?: string
): Promise<CopywriterSeoResult> {
  if (!clipTranscript || clipTranscript.trim().length < MIN_TRANSCRIPT_CHARS) {
    throw new Error(`Transcription trop courte pour générer des captions (min ${MIN_TRANSCRIPT_CHARS} caractères)`)
  }

  // Truncate very long transcripts
  const trimmedTranscript = clipTranscript.length > MAX_TRANSCRIPT_CHARS
    ? clipTranscript.slice(0, MAX_TRANSCRIPT_CHARS) + '\n\n[... transcription tronquée]'
    : clipTranscript

  const anthropic = createAnthropicClient()

  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 3072,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Génère des captions + hashtags optimisés pour ce clip.${niche ? `\nNiche : ${niche}` : ''}

Réponds en JSON :
{
  "tiktok": {
    "caption": "1-2 lignes max + CTA. PAS de hashtags dans la caption. Max ${PLATFORM_RULES.tiktok.maxCaptionChars} caractères.",
    "hashtags": ["#hashtag1", "#hashtag2", "... ${PLATFORM_RULES.tiktok.minHashtags}-${PLATFORM_RULES.tiktok.maxHashtags} hashtags"]
  },
  "instagram": {
    "caption": "3-6 lignes storytelling + CTA save/share. Hook en première ligne. Max ${PLATFORM_RULES.instagram.maxCaptionChars} caractères.",
    "hashtags": ["#hashtag1", "#hashtag2", "... ${PLATFORM_RULES.instagram.minHashtags}-${PLATFORM_RULES.instagram.maxHashtags} hashtags"]
  },
  "youtube": {
    "caption": "Titre SEO + 2-3 phrases description avec keywords. Max ${PLATFORM_RULES.youtube.maxCaptionChars} caractères.",
    "hashtags": ["#hashtag1", "#hashtag2", "... ${PLATFORM_RULES.youtube.minHashtags}-${PLATFORM_RULES.youtube.maxHashtags} hashtags"]
  },
  "split_screen": {
    "recommended_background": "sand|slime|parkour|minecraft|cooking",
    "speed_ratio": 0.8,
    "contrast_reason": "Pourquoi ce fond amplifie le message"
  }
}

IMPORTANT :
- Chaque hashtag DOIT commencer par #
- AUCUN hashtag en double (ni dans une plateforme, ni entre plateformes)
- Hashtags organisés : viral d'abord, puis mid-range, puis niche
- La langue des captions et hashtags doit correspondre à la langue de la transcription

Transcription du clip :
${trimmedTranscript}`,
      },
    ],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type from Copywriter SEO')

  const parsed = parseClaudeJson<CopywriterSeoResult>(content.text, 'Copywriter SEO')
  return validateAndCleanResult(parsed)
}
