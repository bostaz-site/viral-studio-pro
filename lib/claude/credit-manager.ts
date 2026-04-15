import { createAnthropicClient, CLAUDE_MODEL, parseClaudeJson } from './client'

// ── Types ─────────────────────────────────────────────────────────────────────

export type SourcePlatform = 'youtube' | 'tiktok' | 'instagram' | 'twitter' | 'podcast' | 'unknown'

export type RiskLevel = 'low' | 'medium' | 'high'

export interface PlatformCredit {
  caption_credit: string   // ready-to-paste credit line for this target platform
  hashtag_credit: string   // credit-related hashtag (e.g. #créditcréateur)
}

export interface CreditManagerResult {
  credit_line: string            // universal short credit (e.g. "📹 @username sur TikTok")
  credit_description: string     // longer text that flatters the original creator (2-3 sentences)
  collaboration_hook: string     // invitation to collaborate
  original_link: string          // URL to the original content
  risk_level: RiskLevel
  risk_reason: string            // why this risk level was assigned
  platform_credits: {
    tiktok: PlatformCredit
    instagram: PlatformCredit
    youtube: PlatformCredit
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const VALID_RISK_LEVELS: readonly RiskLevel[] = ['low', 'medium', 'high']

const VALID_SOURCE_PLATFORMS: readonly SourcePlatform[] = [
  'youtube', 'tiktok', 'instagram', 'twitter', 'podcast', 'unknown',
]

const MAX_AUTHOR_LENGTH = 100
const MAX_URL_LENGTH = 500

// ── Prompt ────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es un expert en gestion de crédits et droits d'auteur pour les créateurs de contenu. Tu transformes l'attribution en OPPORTUNITÉ DE COLLABORATION plutôt qu'en simple obligation légale.

## MISSION

Générer un crédit professionnel, visible et flatteur pour le créateur original d'un contenu réutilisé (mode curation/remix). Le crédit doit être adapté à chaque plateforme cible.

## PHILOSOPHIE

Le crédit n'est JAMAIS un aveu de copie. C'est :
- Une RECOMMANDATION qui valorise le créateur original
- Un SIGNAL de professionnalisme pour ton audience
- Une PORTE D'ENTRÉE vers une collaboration future
- Une PROTECTION légale proactive

## RÈGLES DE CRÉDIT PAR PLATEFORME CIBLE

### TikTok
- FORMAT : Court, décontracté, avec @mention
- PLACEMENT : Dans la caption, avant les hashtags
- STYLE : "📹 Contenu original : @handle" ou "Inspiré par @handle 🔥"
- HASHTAG CREDIT : #crédit ou #source ou #original
- Si le créateur est sur TikTok → lien direct @handle
- Si le créateur est sur une AUTRE plateforme → "📹 Source : @handle sur YouTube"

### Instagram
- FORMAT : Plus détaillé, storytelling, avec @mention + tag
- PLACEMENT : Fin de caption, avant les hashtags
- STYLE : "🎬 Contenu original par @handle — allez voir son profil pour plus de contenu incroyable"
- HASHTAG CREDIT : #créditcréateur ou #contentcredit
- Taguer le créateur dans la photo/vidéo si possible

### YouTube Shorts
- FORMAT : SEO-friendly, dans la description
- PLACEMENT : Première ligne de description après le titre
- STYLE : "Source : [Nom du créateur] (lien dans la description)" + lien complet
- HASHTAG CREDIT : #credit #source
- Inclure le lien complet car YouTube le rend cliquable

## ÉVALUATION DU RISQUE

Évalue le risk_level selon ces critères :
- LOW : Contenu éducatif/informatif, fair use probable, créateur petit/moyen, contenu libre de droits
- MEDIUM : Contenu divertissant, créateur avec audience significative, transformation partielle du contenu
- HIGH : Contenu commercial, créateur majeur/vérifié, peu de transformation, musique protégée, contenu de marque

## EDGE CASES

- Créateur INCONNU → utilise le nom de la chaîne/page, mentionne la plateforme source
- Handle MANQUANT → utilise le nom complet + plateforme ("John Doe sur YouTube")
- URL MANQUANTE → mentionne la plateforme sans lien, suggère de chercher le créateur
- Plateforme source DIFFÉRENTE de cible → adapte le format (ex: "Retrouvez @user sur TikTok 👉 lien")

## FORMAT DE RÉPONSE

Retourne UNIQUEMENT du JSON valide sans markdown ni backticks.`

// ── Validation ────────────────────────────────────────────────────────────────

function sanitize(input: string, maxLen: number): string {
  return input.slice(0, maxLen).replace(/[{}]/g, '').trim()
}

function normalizeSourcePlatform(raw: string): SourcePlatform {
  const lower = raw.toLowerCase().trim()
  // Map common variations
  if (lower.includes('youtube') || lower === 'yt') return 'youtube'
  if (lower.includes('tiktok') || lower === 'tt') return 'tiktok'
  if (lower.includes('instagram') || lower === 'ig' || lower === 'insta') return 'instagram'
  if (lower.includes('twitter') || lower === 'x') return 'twitter'
  if (lower.includes('podcast') || lower.includes('spotify') || lower.includes('apple')) return 'podcast'
  if (VALID_SOURCE_PLATFORMS.includes(lower as SourcePlatform)) return lower as SourcePlatform
  return 'unknown'
}

function isPlausibleUrl(url: string): boolean {
  if (!url || url.length < 10) return false
  return /^https?:\/\/.+\..+/.test(url)
}

function validateRiskLevel(raw: unknown): RiskLevel {
  if (typeof raw === 'string') {
    const lower = raw.toLowerCase().trim() as RiskLevel
    if (VALID_RISK_LEVELS.includes(lower)) return lower
  }
  return 'medium' // safe default
}

function validateNonEmptyString(val: unknown, fallback: string): string {
  if (typeof val === 'string' && val.trim().length > 0) return val.trim()
  return fallback
}

function validatePlatformCredit(raw: unknown, fallbackCaption: string): PlatformCredit {
  const obj = raw as Record<string, unknown> | null

  const captionCredit = obj && typeof obj.caption_credit === 'string' && obj.caption_credit.trim().length > 0
    ? obj.caption_credit.trim()
    : fallbackCaption

  const hashtagCredit = obj && typeof obj.hashtag_credit === 'string' && obj.hashtag_credit.trim().length > 0
    ? obj.hashtag_credit.trim().toLowerCase().replace(/\s+/g, '')
    : '#credit'

  return {
    caption_credit: captionCredit,
    hashtag_credit: hashtagCredit.startsWith('#') ? hashtagCredit : '#' + hashtagCredit,
  }
}

function validateAndCleanResult(
  raw: CreditManagerResult,
  originalUrl: string,
  authorName: string,
  sourcePlatform: SourcePlatform
): CreditManagerResult {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Credit Manager: invalid response structure')
  }

  // ── credit_line ──
  const creditLine = validateNonEmptyString(
    raw.credit_line,
    `📹 ${authorName || 'Créateur original'}${sourcePlatform !== 'unknown' ? ` sur ${sourcePlatform}` : ''}`
  )

  // ── credit_description ──
  const creditDescription = validateNonEmptyString(
    raw.credit_description,
    `Contenu original par ${authorName || 'le créateur'}. Allez découvrir son profil pour plus de contenu de qualité.`
  )

  // ── collaboration_hook ──
  const collaborationHook = validateNonEmptyString(
    raw.collaboration_hook,
    'Contacte-nous pour collaborer ensemble sur du contenu original !'
  )

  // ── original_link — prefer the URL we already have (source of truth) ──
  let link = originalUrl
  if (!isPlausibleUrl(link) && typeof raw.original_link === 'string' && isPlausibleUrl(raw.original_link)) {
    link = raw.original_link.trim()
  }
  if (!isPlausibleUrl(link)) {
    link = ''
  }

  // ── risk_level ──
  const riskLevel = validateRiskLevel(raw.risk_level)

  // ── risk_reason ──
  const riskReason = validateNonEmptyString(
    raw.risk_reason,
    riskLevel === 'low'
      ? 'Contenu éducatif/informatif avec transformation significative'
      : riskLevel === 'high'
        ? 'Contenu commercial ou créateur majeur — vérifier les droits avant publication'
        : 'Risque modéré — crédit visible recommandé'
  )

  // ── platform_credits ──
  const fallbackCredit = creditLine
  const platformCreditsRaw = raw.platform_credits as Record<string, unknown> | undefined
  const platformCredits = {
    tiktok: validatePlatformCredit(platformCreditsRaw?.tiktok, fallbackCredit),
    instagram: validatePlatformCredit(platformCreditsRaw?.instagram, fallbackCredit),
    youtube: validatePlatformCredit(platformCreditsRaw?.youtube, fallbackCredit),
  }

  return {
    credit_line: creditLine,
    credit_description: creditDescription,
    collaboration_hook: collaborationHook,
    original_link: link,
    risk_level: riskLevel,
    risk_reason: riskReason,
    platform_credits: platformCredits,
  }
}

// ── Runner ────────────────────────────────────────────────────────────────────

export async function runCreditManager(
  authorName: string,
  sourcePlatform: string,
  originalUrl: string
): Promise<CreditManagerResult> {
  // Sanitize inputs
  const safeAuthor = sanitize(authorName || 'Créateur inconnu', MAX_AUTHOR_LENGTH)
  const normalizedPlatform = normalizeSourcePlatform(sourcePlatform)
  const safeUrl = sanitize(originalUrl || '', MAX_URL_LENGTH)

  const anthropic = createAnthropicClient()

  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Génère un crédit professionnel et valorisant pour ce créateur, adapté à chaque plateforme cible.

Créateur : ${safeAuthor}
Plateforme source : ${normalizedPlatform}
URL originale : ${safeUrl || 'Non disponible'}

Réponds en JSON :
{
  "credit_line": "📹 Crédit court universel avec @mention",
  "credit_description": "Texte plus long qui valorise le créateur (2-3 phrases, ton flatteur et professionnel)",
  "collaboration_hook": "Phrase invitant le créateur à collaborer",
  "original_link": "${safeUrl || ''}",
  "risk_level": "low|medium|high",
  "risk_reason": "Explication en 1 phrase de pourquoi ce niveau de risque",
  "platform_credits": {
    "tiktok": {
      "caption_credit": "Crédit prêt à coller dans une caption TikTok (court, avec @mention, emoji)",
      "hashtag_credit": "#créditcréateur"
    },
    "instagram": {
      "caption_credit": "Crédit prêt à coller dans une caption Instagram (plus détaillé, avec @mention + tag)",
      "hashtag_credit": "#contentcredit"
    },
    "youtube": {
      "caption_credit": "Crédit pour la description YouTube Shorts (SEO-friendly, avec lien si disponible)",
      "hashtag_credit": "#credit"
    }
  }
}

${!safeUrl ? 'NOTE : Aucune URL fournie — ne mets pas de faux lien, laisse original_link vide.' : ''}
${safeAuthor === 'Créateur inconnu' ? 'NOTE : Le nom du créateur est inconnu — utilise un crédit générique basé sur la plateforme source.' : ''}`,
      },
    ],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type from Credit Manager')

  const parsed = parseClaudeJson<CreditManagerResult>(content.text, 'Credit Manager')
  return validateAndCleanResult(parsed, safeUrl, safeAuthor, normalizedPlatform)
}
