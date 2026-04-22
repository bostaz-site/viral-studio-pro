# PROMPT — Enhance AI Moods (Detection de mood + presets intelligents)

Tu travailles sur Viral Animal, une webapp Next.js 14 (App Router) + TypeScript + Tailwind CSS + Supabase. Le projet est deja fonctionnel. Lis le fichier CLAUDE.md pour le contexte complet du projet.

## CONTEXTE

La page Enhance (`app/(dashboard)/dashboard/enhance/[clipId]/page.tsx`) existe deja et fonctionne. Le bouton "Make It Viral" applique actuellement un preset FIXE identique pour tous les clips :
- Hormozi Purple captions, Scale emphasis, 60%, 1 mot/ligne
- Viral Glow tag 85%
- Dynamic smart zoom
- Audio enhance ON
- Hook Suspense, reorder ON, 1.5s

Le probleme : chaque clip a un mood different (rage, funny, drama, etc.) et le meme preset ne convient pas a tous. On veut que "Make It Viral" DETECTE le mood du clip via Claude Haiku et applique le preset optimise pour CE mood.

## IMPORTANT

- On ne touche PAS au systeme de preview CSS ni au render FFmpeg
- On change UNIQUEMENT la logique de selection des parametres dans "Make It Viral"
- On ajoute 6 boutons de mood dans l'UI pour que le user puisse override
- Chaque parametre dans les presets doit correspondre EXACTEMENT a une option existante dans l'UI
- Mets a jour `docs/enhance-render.md` a la fin avec tout le systeme de moods

## CE QUE TU DOIS CODER

### 1. DETECTION DE MOOD — `lib/ai/mood-detector.ts`

Cree un fichier qui contient le prompt system et la logique d'appel a Claude.

**Input** : transcription du clip (texte), titre du clip, nom du streamer, niche
**Output** : un des 6 moods + confiance + explication courte

```typescript
type ClipMood = 'rage' | 'funny' | 'drama' | 'wholesome' | 'hype' | 'story'

interface MoodDetectionResult {
    mood: ClipMood
    confidence: number          // 0-100
    explanation: string         // ex: "Le streamer crie et slam, vocabulaire agressif"
    secondary_mood?: ClipMood   // mood secondaire si applicable
}
```

**Prompt Claude** :
Le prompt doit demander a Claude Haiku d'analyser la transcription et de retourner le mood dominant parmi :
- `rage` — cris, colere, frustration, slam, jurons, vocabulaire agressif, ton monte
- `funny` — rires, blagues, situations absurdes, reactions droles, ton leger
- `drama` — confrontation, tension, beef, accusations, ton serieux/intense
- `wholesome` — moments touchants, donations, gratitude, ton doux/emotif
- `hype` — victoire, celebration, moments epiques, foule qui crie, ton surexcite
- `story` — narration, monologue, explication, histoire racontee, ton pose/continu

Le prompt doit retourner du JSON strict : `{ "mood": "...", "confidence": 0-100, "explanation": "...", "secondary_mood": "..." }`

**Important** : Utilise l'API Claude Haiku (claude-3-5-haiku ou le modele le moins cher disponible). La cle API est dans les variables d'environnement (`ANTHROPIC_API_KEY` ou passe par le VPS existant qui a deja l'acces Claude via `/api/render/hook`).

Regarde comment le hook est genere dans le code existant (le VPS appelle Claude pour generer les hooks). Reutilise le meme pattern/endpoint si possible au lieu de creer un nouvel appel direct. Si le VPS a deja un endpoint qui appelle Claude, ajoute la detection de mood la-dedans.

### 2. LES 6 PRESETS DE MOOD — `lib/ai/mood-presets.ts`

Chaque preset doit mapper EXACTEMENT aux options existantes dans l'UI de la page Enhance. Voici les noms exacts des settings tels qu'ils sont dans le code :

```typescript
interface MoodPreset {
    mood: ClipMood
    label: string
    emoji: string
    description: string
    
    // Captions — doit matcher les options dans CAPTION_STYLES
    captionTemplate: string              // 'mrbeast' | 'hormozi-purple' | 'neon' | 'bold' | 'minimal' | 'aliabdaal' | 'hormozi' | 'none'
    wordsPerLine: number                 // 1-8
    captionPosition: number              // 0-100 (pourcentage vertical)
    
    // Emphasis — doit matcher les options dans le code
    emphasisEffect: string               // 'none' | 'scale' | 'bounce' | 'glow'
    emphasisColor: string                // 'red' | 'yellow' | 'cyan' | 'green' | 'orange' | 'pink' | 'purple' | 'white'
    
    // Split-screen — TOUJOURS off pour les presets AI
    broll: string                        // TOUJOURS 'none'
    splitRatio: number                   // 60 (defaut, pas utilise puisque broll=none)
    
    // Cadrage video
    cadrage: string                      // 'contain' | 'fill' | 'immersive'
    
    // Tag
    tagStyle: string                     // 'viral-glow' | 'pop-creator' | 'minimal-pro' | 'none'
    tagSize: number                      // 50-150
    
    // Format
    aspectRatio: string                  // '9:16' (toujours pour TikTok/Reels)
    
    // Smart Zoom
    smartZoomEnabled: boolean
    smartZoomMode: string                // 'micro' | 'dynamic' | 'follow'
    
    // Audio
    audioEnhance: boolean
    
    // Auto-cut silences
    autoCutEnabled: boolean
    autoCutThreshold: number             // 0.3-2.0 secondes
    
    // Hook
    hookEnabled: boolean
    hookTextEnabled: boolean
    hookReorderEnabled: boolean
    hookStyle: string                    // 'shock' | 'curiosity' | 'suspense'
    hookTextPosition: number             // 5-85
    hookDuration: number                 // 1-3 secondes
}
```

**VOICI LES 6 PRESETS EXACTS :**

#### RAGE / FREAKOUT 🔥
```typescript
{
    mood: 'rage',
    label: 'Rage',
    emoji: '🔥',
    description: 'Max retention on raw shock — screaming, slamming, intense moments',
    
    captionTemplate: 'mrbeast',          // MrBeast = word pop, haut contraste blanc/noir
    wordsPerLine: 1,                     // 1 mot a la fois = impact maximum
    captionPosition: 42,                 // Niveau du visage
    
    emphasisEffect: 'scale',             // Mots importants grossissent
    emphasisColor: 'red',                // Rouge = rage
    
    broll: 'none',                       // PAS de split-screen, le rage retient seul
    splitRatio: 60,
    
    cadrage: 'fill',                     // Fill = zoom 115%, immersif
    
    tagStyle: 'viral-glow',              // Neon purple glow
    tagSize: 85,
    
    aspectRatio: '9:16',
    
    smartZoomEnabled: true,
    smartZoomMode: 'dynamic',            // Punch zoom sur les peaks audio
    
    audioEnhance: true,
    
    autoCutEnabled: true,                // Couper les micro-pauses entre les cris
    autoCutThreshold: 0.5,              // Agressif
    
    hookEnabled: true,
    hookTextEnabled: true,
    hookReorderEnabled: true,            // Mettre le moment fort en premier
    hookStyle: 'shock',                  // 💀
    hookTextPosition: 15,
    hookDuration: 1,                     // Court et violent
}
```

#### FUNNY / COMEDY 😂
```typescript
{
    mood: 'funny',
    label: 'Funny',
    emoji: '😂',
    description: 'Instant laughs — jokes, fails, funny reactions',
    
    captionTemplate: 'hormozi-purple',   // Hormozi Purple = word pop violet
    wordsPerLine: 2,                     // 2 mots = rythme de blague
    captionPosition: 42,                 // Niveau du visage
    
    emphasisEffect: 'bounce',            // Mots qui sautent = leger et fun
    emphasisColor: 'yellow',             // Jaune = energie positive
    
    broll: 'none',
    splitRatio: 60,
    
    cadrage: 'fill',
    
    tagStyle: 'pop-creator',             // Pop = fun, colore
    tagSize: 85,
    
    aspectRatio: '9:16',
    
    smartZoomEnabled: true,
    smartZoomMode: 'micro',              // Subtil = souligne les expressions sans distraire
    
    audioEnhance: true,
    
    autoCutEnabled: false,               // Garder le timing comique naturel
    autoCutThreshold: 0.7,
    
    hookEnabled: true,
    hookTextEnabled: true,
    hookReorderEnabled: true,
    hookStyle: 'curiosity',              // 👀 WAIT FOR IT
    hookTextPosition: 15,
    hookDuration: 1.5,
}
```

#### DRAMA / BEEF 🎭
```typescript
{
    mood: 'drama',
    label: 'Drama',
    emoji: '🎭',
    description: 'Tension and confrontation — beef, accusations, intense moments',
    
    captionTemplate: 'bold',             // Bold = word pop, gros texte, impact
    wordsPerLine: 2,                     // 1-2 mots = chaque mot pese
    captionPosition: 42,                 // Niveau du visage
    
    emphasisEffect: 'glow',              // Glow = lueur dramatique
    emphasisColor: 'orange',             // Orange = alerte, tension
    
    broll: 'none',
    splitRatio: 60,
    
    cadrage: 'immersive',                // Immersive = zoom 135%, super intime
    
    tagStyle: 'viral-glow',              // Glow = serieux, premium
    tagSize: 85,
    
    aspectRatio: '9:16',
    
    smartZoomEnabled: true,
    smartZoomMode: 'follow',             // Follow face = verrouille sur les yeux/reactions
    
    audioEnhance: true,
    
    autoCutEnabled: false,               // Les pauses ajoutent a la tension
    autoCutThreshold: 0.7,
    
    hookEnabled: true,
    hookTextEnabled: true,
    hookReorderEnabled: true,
    hookStyle: 'suspense',               // ⏳ tension
    hookTextPosition: 15,
    hookDuration: 2,                     // Plus long = suspense
}
```

#### WHOLESOME / EMOTIONAL ✨
```typescript
{
    mood: 'wholesome',
    label: 'Wholesome',
    emoji: '✨',
    description: 'Touching moments — donations, gratitude, emotional reactions',
    
    captionTemplate: 'minimal',          // Minimal = doux, clean, pas agressif
    wordsPerLine: 4,                     // Plus de mots = lecture fluide et calme
    captionPosition: 42,                 // Niveau du visage
    
    emphasisEffect: 'none',              // Pas d'emphasis = naturel, pas de distraction
    emphasisColor: 'white',              // Blanc pur
    
    broll: 'none',
    splitRatio: 60,
    
    cadrage: 'contain',                  // Contain = naturel, pas de zoom agressif
    
    tagStyle: 'minimal-pro',             // Clean, discret
    tagSize: 85,
    
    aspectRatio: '9:16',
    
    smartZoomEnabled: true,
    smartZoomMode: 'micro',              // Micro = breathing doux, pas intrusif
    
    audioEnhance: true,
    
    autoCutEnabled: false,               // Garder les pauses naturelles (emotion)
    autoCutThreshold: 0.7,
    
    hookEnabled: true,
    hookTextEnabled: true,
    hookReorderEnabled: false,           // NE PAS reordonner — l'emotion est dans l'ordre naturel
    hookStyle: 'curiosity',              // 👀 doux
    hookTextPosition: 15,
    hookDuration: 1.5,
}
```

#### HYPE / W 🏆
```typescript
{
    mood: 'hype',
    label: 'Hype',
    emoji: '🏆',
    description: 'Pure adrenaline — victories, epic moments, crowd going wild',
    
    captionTemplate: 'neon',             // Neon = glow electrique, gaming hype
    wordsPerLine: 1,                     // 1 mot = CHAQUE mot frappe
    captionPosition: 42,                 // Niveau du visage
    
    emphasisEffect: 'scale',             // Scale = mots qui explosent au visage
    emphasisColor: 'cyan',               // Cyan = electrique, energique
    
    broll: 'none',
    splitRatio: 60,
    
    cadrage: 'fill',                     // Fill = immersif mais pas trop
    
    tagStyle: 'pop-creator',             // Pop = energique, colore
    tagSize: 85,
    
    aspectRatio: '9:16',
    
    smartZoomEnabled: true,
    smartZoomMode: 'dynamic',            // Dynamic = punch zoom sur les peaks
    
    audioEnhance: true,
    
    autoCutEnabled: true,                // Couper les respirations = mur de son
    autoCutThreshold: 0.5,              // Agressif
    
    hookEnabled: true,
    hookTextEnabled: true,
    hookReorderEnabled: true,            // Moment fort en premier
    hookStyle: 'shock',                  // 💀 
    hookTextPosition: 15,
    hookDuration: 1,                     // Court et explosif
}
```

#### STORY / RANT 🗣️
```typescript
{
    mood: 'story',
    label: 'Story',
    emoji: '🗣️',
    description: 'Narration and monologues — stories, rants, explanations',
    
    captionTemplate: 'aliabdaal',        // Ali Abdaal = phrase reveal (pas word pop)
    wordsPerLine: 5,                     // Plus de mots = lecture a son rythme
    captionPosition: 42,                 // Niveau du visage
    
    emphasisEffect: 'none',              // Pas d'emphasis agressif sur du contenu parle
    emphasisColor: 'white',
    
    broll: 'none',                       // PAS de split-screen (option manuelle dispo)
    splitRatio: 60,
    
    cadrage: 'contain',                  // Contain = naturel
    
    tagStyle: 'minimal-pro',             // Discret, pas de distraction
    tagSize: 85,
    
    aspectRatio: '9:16',
    
    smartZoomEnabled: true,
    smartZoomMode: 'micro',              // Micro = juste assez de mouvement
    
    audioEnhance: true,
    
    autoCutEnabled: true,                // Couper les silences = flux constant
    autoCutThreshold: 0.7,              // Pas trop agressif pour garder le naturel
    
    hookEnabled: true,
    hookTextEnabled: true,
    hookReorderEnabled: false,           // NE PAS reordonner — l'histoire se suit
    hookStyle: 'suspense',              // ⏳
    hookTextPosition: 15,
    hookDuration: 2,                     // Plus long pour poser le contexte
}
```

### 3. API ROUTE — `app/api/enhance/ai-optimize/route.ts`

Route protegee par `withAuth`. 

**POST** :
- Input : `{ transcript: string, title?: string, streamer?: string, niche?: string }`
- Valider avec Zod
- Appeler la fonction de detection de mood (soit via le VPS existant, soit directement l'API Claude)
- Retourner : `{ mood, confidence, explanation, secondary_mood, preset: MoodPreset }`

**Fallback** : Si Claude API echoue pour n'importe quelle raison, retourner le mood 'hype' par defaut (c'est le preset le plus polyvalent).

### 4. MODIFICATION DE LA PAGE ENHANCE

#### Dans `app/(dashboard)/dashboard/enhance/[clipId]/page.tsx` :

**A. Modifier le bouton "Make It Viral" :**

Actuellement le bouton applique un preset fixe. Modifier pour :
1. Afficher un loading state "Analyzing clip mood..."
2. Appeler `POST /api/enhance/ai-optimize` avec la transcription
3. Quand la reponse arrive, appliquer le preset du mood detecte
4. Afficher le mood detecte avec un badge
5. Declencher la generation de hook (existant) puis l'auto-render (existant)

**B. Ajouter la barre de moods dans l'UI :**

En haut de la section settings (juste en dessous du bouton "Make It Viral"), ajouter une rangee de 6 boutons :

```
[🔥 Rage] [😂 Funny] [🎭 Drama] [✨ Wholesome] [🏆 Hype] [🗣️ Story]
```

Comportement :
- Quand "Make It Viral" detecte un mood, le bouton correspondant est auto-selectionne (highlighted)
- Le badge "AI Detected" apparait sur le bouton selectionne
- L'user peut cliquer sur n'importe quel autre mood pour changer — ca applique le nouveau preset immediatement
- Cliquer sur un mood N'auto-render PAS (contrairement a "Make It Viral") — ca change juste les settings
- Si aucun mood n'est selectionne, les boutons sont tous en etat neutre
- Style : boutons arrondis, dark theme, le selectionne a un border glow de la couleur du mood

**C. Badge de mood detecte :**

Quand un mood est detecte par l'AI, afficher un petit badge au-dessus de la barre de score "Chance de blowup" :
- "🔥 Rage detected — AI confidence: 87%"
- Texte de l'explication en dessous en petit (ex: "Screaming and aggressive vocabulary detected")
- Si secondary_mood existe : "Also detected: 😂 Funny"

### 5. INTEGRATION AVEC LE HOOK EXISTANT

Le systeme de hook generation existe deja (via `/api/render/hook` ou le VPS). Quand "Make It Viral" est clique :

1. D'abord detecter le mood (nouveau)
2. Appliquer le preset du mood (nouveau)  
3. PUIS generer le hook avec le style du preset (shock/curiosity/suspense) — CA C'EST EXISTANT, ne pas recoder
4. Auto-render — EXISTANT, ne pas recoder

Le mood preset definit le `hookStyle` (shock, curiosity, ou suspense), et c'est ce style qui est passe a la generation de hook existante. On ne change pas la generation de hook, on change juste quel style est demande.

---

## FICHIERS A CREER

```
lib/ai/mood-detector.ts                              -- Logique de detection de mood via Claude
lib/ai/mood-presets.ts                               -- Les 6 presets mappes en TypeScript
app/api/enhance/ai-optimize/route.ts                 -- API route pour la detection
```

## FICHIERS A MODIFIER

```
app/(dashboard)/dashboard/enhance/[clipId]/page.tsx   -- Bouton Make It Viral + barre de moods + badge
docs/enhance-render.md                                -- Documentation mise a jour avec le systeme de moods
docs/README.md                                        -- Ajouter lien si necessaire
```

## CE QU'ON NE TOUCHE PAS

- Le systeme de preview CSS (`components/enhance/live-preview.tsx`) — AUCUN changement
- Le render FFmpeg (VPS) — AUCUN changement
- Le systeme de hook generation — AUCUN changement (on reutilise tel quel)
- Le scoring engine (`lib/enhance/scoring.ts`) — AUCUN changement
- Les options manuelles de l'UI — AUCUN changement (tout reste accessible manuellement)
- Le split-screen, les tags, les captions — tout reste configurable manuellement par le user APRES que le preset AI est applique

---

## REGLES DE CODE

- TypeScript strict, pas de `any`
- Noms de fichiers en kebab-case
- Composants React en PascalCase
- Dark mode uniquement
- Design des boutons de mood : coherent avec le dark theme existant, bordures subtiles, glow sur le selectionne
- Utilise les composants UI existants dans `components/ui/`
- Valider les inputs avec Zod dans les API routes
- Verifier l'authentification avec `withAuth`
- Gerer les erreurs avec try/catch — si Claude API fail, fallback silencieux sur le preset 'hype'
- Loading state pendant la detection du mood
- Fais `npx tsc --noEmit` a la fin pour verifier 0 erreurs TypeScript

## IMPORTANT — MAPPING DES PARAMETRES

Quand tu appliques un preset, tu dois setter CHAQUE parametre du state de la page Enhance. Lis le code de la page Enhance pour comprendre quels sont les noms exacts des variables de state et comment elles sont settees par le preset "Make It Viral" actuel. Reproduis le meme pattern mais avec les valeurs du mood detecte.

Par exemple, si le code actuel fait :
```typescript
setCaptionTemplate('hormozi-purple')
setWordsPerLine(1)
setCaptionPosition(60)
```

Tu dois remplacer par les valeurs du preset du mood detecte :
```typescript
setCaptionTemplate(preset.captionTemplate)
setWordsPerLine(preset.wordsPerLine)
setCaptionPosition(preset.captionPosition)
```

Assure-toi que TOUS les parametres sont mappes, pas seulement quelques-uns. Verifie chaque setter dans le code du "Make It Viral" actuel et assure-toi que le preset couvre chacun d'entre eux.
