---
name: clip-cutter
description: "Decoupe une video longue en clips courts optimises pour TikTok/Reels/Shorts via FFmpeg. Gere le reframe vertical 9:16, les sous-titres karaoke, le split-screen et le watermark. Se declenche quand l'utilisateur dit 'decoupe le clip', 'rends le clip', 'genere la video', 'ajoute les sous-titres', 'format vertical', 'split-screen', ou quand le Retention Editor a fourni les timestamps de decoupe."
---

# Clip Cutter — Viral Animal

> Position dans le pipeline : Skill 3/4 — s'execute apres Hook Hunter et Retention Editor. Consomme les segments et le champ `energy` du Retention Editor. Le Copywriter SEO et Credit Manager s'executent en parallele ou apres le rendu.

## Objectif
Orchestre FFmpeg pour transformer les segments identifies par le Retention Editor
en clips video finis : decoupe, reframe vertical 9:16, sous-titres karaoke,
split-screen optionnel, et watermark. C'est le dernier maillon du pipeline avant preview.

## Instructions

### Parametres d'entree

```json
{
  "video_id": "uuid",
  "source_path": "videos/{user_id}/{video_id}.mp4",
  "segments": [
    {"start": 12.5, "end": 28.3},
    {"start": 45.1, "end": 67.8}
  ],
  "order": [0, 1],
  "options": {
    "aspect_ratio": "9:16",
    "captions": true,
    "caption_style": "karaoke" | "static" | "none",
    "caption_emphasis": true,
    "split_screen": false,
    "broll_path": null,
    "broll_sync": "random" | "energy_match",
    "watermark": true,
    "output_quality": "high" | "medium" | "draft",
    "editing_style": "mrbeast" | "podcast" | "storytelling" | "educatif" | "default",
    "dynamic_cuts": true,
    "zoom_on_emphasis": true
  },
  "word_timestamps": [{"word": "...", "start": 0.0, "end": 0.3}],
  "user_plan": "free" | "pro" | "studio"
}
```

### Donnees du Retention Editor
Le Clip Cutter consomme directement l'output du Retention Editor :
- `segments` : les timestamps de decoupe
- `order` : correspond a `suggested_order` du Retention Editor
- `energy` par segment (`"low"` | `"medium"` | `"high"`) : utilise pour le B-roll sync en mode `energy_match`

### Pipeline standard (un clip)

1. **Valider les inputs** : video source existe + tous les index de `order` existent dans `segments` (sinon erreur avant FFmpeg)
2. Telecharger la video source en local (fichier temp)
3. Decouper les segments selon l'ordre du Retention Editor
4. Concatener les segments dans l'ordre suggere
5. Appliquer le reframe vertical 9:16 (speaker tracking si disponible)
6. Ajouter les sous-titres karaoke (si word_timestamps et captions: true)
7. Ajouter le watermark "Viral Animal" (si user_plan == "free")
8. Encoder en H.264 / AAC avec la qualite demandee
9. Generer le thumbnail (frame a 1/3 de la duree)
10. Uploader clip + thumbnail dans Supabase Storage
11. Mettre a jour la table `clips` (status: 'done', storage_path, thumbnail_path)
12. Nettoyer les fichiers temporaires

### Commandes FFmpeg

#### Decoupe + concatenation de segments
```bash
# Extraire chaque segment
ffmpeg -i input.mp4 -ss 12.5 -to 28.3 -c copy seg_0.mp4
ffmpeg -i input.mp4 -ss 45.1 -to 67.8 -c copy seg_1.mp4

# Creer la liste de concatenation
echo "file 'seg_0.mp4'" > concat.txt
echo "file 'seg_1.mp4'" >> concat.txt

# Concatener
ffmpeg -f concat -safe 0 -i concat.txt -c copy merged.mp4
```

#### Reframe vertical 9:16 (crop centre)
```bash
ffmpeg -i merged.mp4 -vf "crop=ih*9/16:ih" -c:a copy vertical.mp4
```

#### Reframe vertical 9:16 (speaker tracking)
```bash
# Utilise lib/ffmpeg/speaker-track.ts pour detecter la position du speaker
# puis applique un crop dynamique centre sur le visage
ffmpeg -i merged.mp4 -vf "crop=ih*9/16:ih:x={speaker_x}:y=0" -c:a copy vertical.mp4

# FALLBACK : si speaker-track.ts ne detecte pas de visage (pas de visage,
# plusieurs visages, ou score de confiance trop bas), utiliser le crop centre :
# ffmpeg -i merged.mp4 -vf "crop=ih*9/16:ih" -c:a copy vertical.mp4
```

#### Sous-titres karaoke (ASS)
```bash
# Genere le fichier .ass depuis word_timestamps via lib/ffmpeg/captions.ts
ffmpeg -i vertical.mp4 -vf "ass=captions.ass" -c:a copy subtitled.mp4
```

#### Split-screen (haut: clip, bas: B-roll)
```bash
ffmpeg -i clip.mp4 -i broll.mp4 \
  -filter_complex "[0:v]scale=1080:960[top];[1:v]scale=1080:960[bot];[top][bot]vstack" \
  -c:a copy split.mp4
```

#### Watermark (plan gratuit uniquement)
```bash
ffmpeg -i input.mp4 \
  -vf "drawtext=text='Viral Animal':fontsize=24:fontcolor=white@0.5:x=w-tw-20:y=h-th-20" \
  output.mp4
```

#### Thumbnail
```bash
# Frame a 1/3 de la duree totale
ffmpeg -i final.mp4 -ss {duration/3} -vframes 1 -q:v 2 thumbnail.jpg
```

#### Encodage final (qualite)
```bash
# HIGH (publication)
ffmpeg -i input.mp4 -c:v libx264 -preset slow -crf 18 -c:a aac -b:a 128k output.mp4

# MEDIUM (preview)
ffmpeg -i input.mp4 -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 96k output.mp4

# DRAFT (apercu rapide)
ffmpeg -i input.mp4 -c:v libx264 -preset ultrafast -crf 28 -c:a aac -b:a 64k output.mp4
```

### Retention-Driven Editing

#### Cuts dynamiques (dynamic_cuts: true)
Optimiser le montage pour la retention :
- Cuts toutes les 1-3 secondes si le style le permet
- Zoom subtil (1.1x-1.3x) sur les moments importants (zoom_on_emphasis)
- Eviter les temps morts > 0.5 seconde
- Jump cuts sur les pauses longues

#### Editing styles
| Style | Cuts | Zoom | Rythme | Usage |
|---|---|---|---|---|
| mrbeast | Tres frequents (1-2s) | Agressif | Ultra rapide | Divertissement, reactions |
| podcast | Rares (5-10s) | Doux | Pose | Discussions, interviews |
| storytelling | Moderes (3-5s) | Sur emotions | Crescendo | Temoignages, recits |
| educatif | Moderes (3-5s) | Sur points cles | Regulier | Tutoriels, explications |
| default | Adaptatif | Modere | Auto | Adapte au contenu |

#### Sous-titres avec emphase (caption_emphasis: true)
- Mettre en evidence les mots cles avec une couleur differente (ex: jaune sur fond sombre)
- Augmenter la taille des mots importants (1.2x-1.5x)
- Mots a emphasiser : chiffres, noms propres, mots emotionnels, mots d'action
- Style karaoke : le mot actuel est mis en surbrillance

#### B-roll synchronise (broll_sync: "energy_match")
- `random` : B-roll pioche aleatoirement (defaut)
- `energy_match` : B-roll synchronise avec l'energie du clip principal
  - Utilise le champ `energy` (`"low"` | `"medium"` | `"high"`) de chaque segment retourne par le Retention Editor
  - Segments `low` → B-roll plus actif pour maintenir l'attention
  - Segments `high` → B-roll neutre pour ne pas distraire
  - Segments `medium` → B-roll modere
  - Changements de B-roll alignes sur les cuts du clip principal
  - Si `energy` n'est pas present sur un segment, traiter comme `"medium"` par defaut

#### Thumbnail conditionnel
- YouTube : toujours generer (important pour le CTR)
- Dashboard preview : toujours generer
- TikTok/Instagram : optionnel (la plateforme genere le sien)

### Fichiers d'implementation existants
- `lib/ffmpeg/reframe.ts` — Reframe vertical avec detection de visage
- `lib/ffmpeg/captions.ts` — Sous-titres karaoke dynamiques
- `lib/ffmpeg/split-screen.ts` — Montage split-screen
- `lib/ffmpeg/watermark.ts` — Ajout du watermark
- `lib/ffmpeg/broll.ts` — Gestion du B-roll (contenu satisfaisant)
- `lib/ffmpeg/filler-removal.ts` — Suppression des silences et fillers
- `lib/ffmpeg/speaker-track.ts` — Tracking du speaker pour le reframe

### Integration dans le pipeline

#### Mode Createur
1. Retention Editor → timestamps → Clip Cutter → FFmpeg → clip MP4
2. Le clip est uploade dans Supabase Storage (`clips/{user_id}/{clip_id}.mp4`)
3. Le thumbnail est genere et stocke dans `thumbnails/`
4. La table `clips` est mise a jour (status: 'done', storage_path, thumbnail_path)
5. Le clip apparait dans le dashboard pour preview

#### Mode Curateur (split-screen)
1. Video tendance nettoyee (yt-dlp sans watermark) → haut de l'ecran
2. Contenu B-roll satisfaisant (Parkour/Sable/Slime/Minecraft) → bas
3. Audio : original OU voix-off ElevenLabs (phase 2)
4. Sous-titres karaoke centres
5. Resultat : video techniquement neuve (nouveaux pixels, nouveau hash)

## Gestion d'erreurs

| Erreur | Cause | Action |
|---|---|---|
| File not found | Video source supprimee ou path incorrect | Verifier Supabase Storage, mettre clips.status = 'error' |
| Invalid duration | Segment start > end ou hors duree video | Valider les timestamps avant FFmpeg |
| Codec error | Format video non supporte | Re-encoder la source en H.264 d'abord |
| Disk full | Pas assez d'espace sur le VPS | Nettoyer les temp, alerter l'admin |
| Timeout | Video trop longue ou VPS surcharge | Reduire la qualite, retry en mode draft |
| Order index out of range | Index dans `order` n'existe pas dans `segments` | Valider que tous les index de `order` < len(segments) avant FFmpeg |
| Speaker not found | speaker-track.ts ne detecte pas de visage | Fallback sur crop centre (reframe.ts mode centre) |

## Specs techniques
- FFmpeg tourne sur un VPS separe (pas sur Netlify)
- Videos stockees dans Supabase Storage, pas en local
- Resolution de sortie : 1080x1920 (9:16)
- Codec : H.264 (compatibilite universelle)
- Audio : AAC 128kbps
- FPS : conserver le FPS source (ou 30fps par defaut)
- Taille max d'un clip : ~50MB (limite Supabase Storage free tier)

## Contraintes
- Toujours verifier que la video source existe avant de lancer FFmpeg
- Gerer les erreurs FFmpeg avec des messages clairs et un status 'error' en DB
- Le watermark est OBLIGATOIRE sur le plan gratuit (user_plan == "free")
- Ne jamais depasser 90 secondes pour un clip final
- Toujours generer un thumbnail
- Nettoyer TOUS les fichiers temporaires apres le rendu (meme en cas d'erreur)
- Valider les timestamps avant de lancer FFmpeg (start < end, dans la duree video)
