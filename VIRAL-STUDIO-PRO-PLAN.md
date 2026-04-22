# VIRAL STUDIO PRO — Plan Complet du Systeme

> Clone d'OpusClip + Moteur de Curation Virale + Distribution Multi-Plateforme

---

## ARCHITECTURE GLOBALE

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                        │
│                                                             │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ CREER    │  │ TRENDING     │  │ PUBLIER               │ │
│  │ (Upload) │  │ (Curation)   │  │ (Distribution)        │ │
│  └────┬─────┘  └──────┬───────┘  └───────────┬───────────┘ │
└───────┼────────────────┼──────────────────────┼─────────────┘
        │                │                      │
┌───────▼────────────────▼──────────────────────▼─────────────┐
│                    BACKEND (n8n + API)                        │
│                                                              │
│  ┌─────────────┐ ┌──────────────┐ ┌────────────────────┐   │
│  │ Whisper     │ │ Claude AI    │ │ FFmpeg             │   │
│  │ (Transcr.)  │ │ (4 Skills)   │ │ (Montage)          │   │
│  └─────────────┘ └──────────────┘ └────────────────────┘   │
│                                                              │
│  ┌─────────────┐ ┌──────────────┐ ┌────────────────────┐   │
│  │ yt-dlp      │ │ ElevenLabs   │ │ Supabase           │   │
│  │ (Download)  │ │ (Voix-off)   │ │ (DB + Storage)     │   │
│  └─────────────┘ └──────────────┘ └────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

---

## SECTION 1 — CREER (Clone OpusClip)

### 1.1 Upload & Import
| Feature | Description | Priorite |
|---------|-------------|----------|
| Upload fichier | MP4, MOV, MKV, AVI — jusqu'a 2h de video | P0 |
| Coller URL YouTube | Paste un lien → yt-dlp telecharge | P0 |
| Coller URL TikTok/Reels | Import depuis n'importe quelle plateforme | P1 |
| Import Zoom/Meet | Connecter son compte Zoom pour importer | P2 |
| Drag & Drop | Interface drag & drop intuitive | P0 |
| Batch Upload | Upload plusieurs videos d'un coup | P2 |

### 1.2 Transcription & Analyse IA
| Feature | Description | Priorite |
|---------|-------------|----------|
| Transcription auto (Whisper) | 25+ langues, 97%+ precision | P0 |
| Detection des speakers | Identifier qui parle (diarization) | P1 |
| Timeline interactive | Voir la transcription sync avec la video | P0 |
| Detection de langue auto | Detecter la langue sans input user | P1 |

### 1.3 AI Clipping (Le Coeur du Produit)
| Feature | Description | Priorite |
|---------|-------------|----------|
| ClipAnything | 1 clic → 5-20 clips generes automatiquement | P0 |
| Clip par prompt | "Trouve le moment ou il parle de X" en langage naturel | P1 |
| Virality Score (0-100) | Score base sur : hook, emotion, valeur, tendance | P0 |
| Explication du score | Pourquoi ce clip va/va pas marcher | P0 |
| Hook Detection | Identifier les 3 premieres secondes qui accrochent | P0 |
| Retention Analysis | Graphe de retention predite pour chaque clip | P1 |
| Topic Discovery | Detecter les sujets principaux de la video | P1 |
| Classement auto | Clips tries par score viral, du meilleur au pire | P0 |

### 1.4 Captions & Sous-titres
| Feature | Description | Priorite |
|---------|-------------|----------|
| Sous-titres animes (karaoke) | Style mot-par-mot anime | P0 |
| 10+ templates de captions | Differents styles visuels | P0 |
| Highlight de mots-cles | Mots importants en couleur/gras | P0 |
| Emojis automatiques | IA ajoute des emojis contextuels | P1 |
| Speaker color coding | Couleur differente par speaker | P1 |
| Custom fonts | Upload ses propres polices | P2 |
| Position ajustable | Deplacer les sous-titres a l'ecran | P1 |
| 25+ langues | Support multilingue | P1 |

### 1.5 Editing & Montage
| Feature | Description | Priorite |
|---------|-------------|----------|
| Timeline editor | Editeur timeline dans le browser | P0 |
| Trim & Cut | Ajuster debut/fin de chaque clip | P0 |
| AI B-Roll | Ajouter du B-roll contextuel en 1 clic | P1 |
| B-Roll par keywords | Choisir le type de B-roll (stock ou AI) | P1 |
| Filler word removal | Supprimer les "euh", "genre", pauses | P1 |
| Transitions | Effets de transition entre les scenes | P2 |
| Auto-Reframe 9:16 | Recadrage intelligent pour vertical | P0 |
| Multi-format export | 9:16, 1:1, 16:9 | P0 |
| Speaker tracking | Camera suit le speaker qui parle | P1 |
| Zoom dynamique | Zoom auto sur les moments importants | P2 |

### 1.6 Branding & Templates
| Feature | Description | Priorite |
|---------|-------------|----------|
| Brand templates | Logo + couleurs + fonts sauvegardes | P1 |
| Intro/Outro custom | Ajouter une intro/outro automatique | P1 |
| Watermark (plan gratuit) | Watermark "Viral Studio" sur free tier | P0 |
| Presets de style | Styles pre-faits (corporate, fun, news...) | P2 |

### 1.7 Remake This (Notre Edge)
| Feature | Description | Priorite |
|---------|-------------|----------|
| Remake button | 1 clic → Claude reecrit le clip | P0 |
| 3 variantes de hook | 3 accroches alternatives generees | P0 |
| Script reecrit | Nouveau script complet propose | P0 |
| Coach IA | Explication de pourquoi le remake est meilleur | P0 |

### 1.8 Export
| Feature | Description | Priorite |
|---------|-------------|----------|
| Download MP4 | Export direct en MP4 HD | P0 |
| Download SRT | Export des sous-titres separement | P1 |
| Export Premiere Pro | Format XML pour Adobe Premiere | P2 |
| Export DaVinci Resolve | Format compatible DaVinci | P2 |
| Batch download | Telecharger tous les clips d'un coup | P1 |

---

## SECTION 2 — TRENDING (Curation Virale)

> **C'est notre differenciation #1 — OpusClip n'a PAS ca.**

### 2.1 Dashboard Tendances
| Feature | Description | Priorite |
|---------|-------------|----------|
| Feed temps reel | Flux de clips viraux du moment | P0 |
| Filtre par niche | Science, Business, Fitness, Comedy, Tech... | P0 |
| Filtre par plateforme | TikTok, Reels, YouTube Shorts | P0 |
| Velocity Score | Vitesse de croissance des vues (6 premieres heures) | P0 |
| Preview video | Voir le clip directement dans le dashboard | P0 |
| Sauvegarder en favoris | Bookmark les clips qui t'interessent | P1 |

### 2.2 Scraping & Detection
| Feature | Description | Priorite |
|---------|-------------|----------|
| Scan auto toutes les 3h | Cron job n8n qui scrape les tendances | P0 |
| Detection de patterns | IA detecte les formats qui montent | P1 |
| Alertes personnalisees | Notification quand un clip de ta niche explose | P1 |
| Historique des tendances | Voir l'evolution sur 7/30 jours | P2 |

### 2.3 Remontage Intelligent
| Feature | Description | Priorite |
|---------|-------------|----------|
| 1 clic → Remontage | Prendre un clip trending et le "refaire" | P0 |
| Split-screen auto | Haut: clip original / Bas: satisfying content | P0 |
| Voix-off IA (ElevenLabs) | Remplacer la voix par une voix-off generee | P1 |
| Credit Manager auto | "@auteur_original" ajoute automatiquement | P0 |
| Sous-titres karaoke | Memes sous-titres que Section 1 | P0 |
| Nouveau hash video | Video techniquement "neuve" pour l'algo | P0 |

---

## SECTION 3 — PUBLIER (Distribution Multi-Plateforme)

> **Phase 2 — On build ca apres avoir les 50 premiers users.**

### 3.1 Connexion Comptes
| Feature | Description | Priorite |
|---------|-------------|----------|
| Connect TikTok | OAuth TikTok API | P2 |
| Connect Instagram | OAuth Instagram Graph API | P2 |
| Connect YouTube | OAuth YouTube Data API | P2 |
| Connect Facebook | OAuth Facebook API | P3 |
| Connect LinkedIn | OAuth LinkedIn API | P3 |
| Connect X/Twitter | OAuth X API | P3 |
| Multi-comptes | Gerer plusieurs comptes par plateforme | P3 |

### 3.2 Publication
| Feature | Description | Priorite |
|---------|-------------|----------|
| 1 clic = partout | Publier sur toutes les plateformes en 1 clic | P2 |
| Caption IA par plateforme | Claude adapte la description par plateforme | P2 |
| Hashtags optimises | Hashtags generes par le Copywriter SEO | P2 |
| Credit auteur auto | Mention du createur original (si curation) | P2 |
| Lien tracke | UTM/lien court pour mesurer la viralite | P3 |

### 3.3 Scheduling
| Feature | Description | Priorite |
|---------|-------------|----------|
| Calendrier visuel | Vue calendrier de tes publications | P2 |
| Heure optimale par plateforme | IA suggere le meilleur moment | P2 |
| Queue automatique | File d'attente de clips a publier | P2 |
| Preview avant publication | Voir exactement ce qui sera publie | P2 |

### 3.4 Analytics (Futur)
| Feature | Description | Priorite |
|---------|-------------|----------|
| Vues par clip | Tracking des performances | P3 |
| Engagement rate | Likes, comments, shares | P3 |
| Comparaison clips | Quel clip performe le mieux | P3 |
| ROI par plateforme | Quelle plateforme rapporte le plus | P3 |

---

## SECTION 4 — LES 4 SKILLS CLAUDE (Backend IA)

### Skill 1: Hook Hunter
```
Input:  Transcription complete du clip
Output: Top 3 hooks alternatifs classes par potentiel viral
        + type de hook (curiosite/choc/storytelling/transformation)
        + explication de pourquoi ca marche
```

### Skill 2: Retention Editor
```
Input:  Timeline + transcription + duree video
Output: Timestamps precis a garder/couper
        + score de retention par segment
        + suggestions de reordering
```

### Skill 3: Copywriter SEO
```
Input:  Niche + contenu du clip + plateforme cible
Output: Caption optimisee (avec emojis, CTA)
        + 15-30 hashtags tries par pertinence
        + version adaptee par plateforme
```

### Skill 4: Credit Manager
```
Input:  author_name + source_platform + clip_url
Output: Credit formate proprement
        + "Inspiration : @[author]" ou "Credit : @[author]"
        + Lien vers l'original si possible
```

---

## SECTION 5 — STACK TECHNIQUE

### Frontend
| Composant | Technologie | Raison |
|-----------|-------------|--------|
| Framework | Next.js 14 (App Router) | SSR + performance |
| UI | Tailwind CSS + shadcn/ui | Rapide a builder |
| State | Zustand | Simple et leger |
| Video Player | Video.js ou Plyr | Player custom |
| Timeline Editor | Custom (Canvas API) | Controle total |
| Upload | tus.io ou UpChunk | Upload resumable |
| Auth | Supabase Auth | Integre avec la DB |

### Backend / Infrastructure
| Composant | Technologie | Raison |
|-----------|-------------|--------|
| Base de donnees | Supabase (PostgreSQL) | Gratuit + temps reel |
| Stockage fichiers | Supabase Storage | Videos + clips |
| Orchestration | n8n (self-hosted) | Workflows visuels |
| Transcription | OpenAI Whisper API | 97%+ precision |
| IA / Skills | Claude API (Anthropic) | Les 4 skills |
| Montage video | FFmpeg (serveur) | Decoupe + sous-titres |
| Download | yt-dlp | Sans watermark |
| Voix-off | ElevenLabs API | Text-to-speech |
| Hosting | Vercel (front) + VPS (back) | Scaling facile |

### Base de Donnees (Supabase)
```sql
-- Tables principales
users              -- Comptes utilisateurs
videos             -- Videos uploadees/importees
clips              -- Clips generes
transcriptions     -- Texte + timestamps
viral_scores       -- Scores + explications
trending_clips     -- Clips du dashboard trending
social_accounts    -- Comptes connectes
publications       -- Historique de publication
brand_templates    -- Templates de branding
```

---

## SECTION 6 — WORKFLOWS N8N

### Workflow 1: The Hunter (Veille — Cron toutes les 3h)
```
[Cron 3h] → Scrape TikTok/Reels/Shorts trending
  → Calculer Velocity Score par clip
  → Filtrer par niche (tags IA)
  → Sauver dans trending_clips (Supabase)
  → Si score > seuil → Notification user
  → Update dashboard temps reel
```

### Workflow 2: The Maker (Creation — Trigger: upload ou clic)
```
[Upload/URL] → yt-dlp download OU reception fichier
  → Whisper: transcription + timestamps
  → Claude Skills (en parallele):
      ├─ Hook Hunter → hooks + score
      ├─ Retention Editor → timestamps a garder
      ├─ Copywriter SEO → captions + hashtags
      └─ Credit Manager → credits auteur
  → FFmpeg: decoupe + sous-titres + reframe 9:16
  → Calcul Virality Score final
  → Sauvegarde clips dans Supabase
  → Affichage dans le dashboard
```

### Workflow 3: The Speaker (Distribution — Trigger: clic publier)
```
[Validation user] → Recuperer clip + metadata
  → Adapter caption par plateforme (Claude)
  → Injecter credits + hashtags
  → Publier via APIs:
      ├─ TikTok API
      ├─ Instagram Graph API
      ├─ YouTube Data API
      ├─ Facebook API
      └─ LinkedIn / X API
  → Ajouter lien tracke
  → Log dans publications (Supabase)
  → Update analytics
```

---

## SECTION 7 — MONETISATION

| Tier | Prix | Limites |
|------|------|---------|
| **Free** | 0$ | 3 videos/mois, watermark, 60 min processing, 1 plateforme |
| **Pro** | 29$/mois | Illimite, sans watermark, toutes plateformes, Virality Score |
| **Studio** | 79$/mois | + Analytics, Remake illimite, scheduling, brand templates, B-roll IA |

---

## SECTION 8 — ROADMAP DE DEVELOPPEMENT

### Sprint 1 (Semaines 1-2) — MVP Core
- [ ] Setup Supabase (tables + storage)
- [ ] Setup n8n (instance + premiers workflows)
- [ ] Frontend: page upload + player video
- [ ] Workflow Maker: upload → Whisper → Claude → FFmpeg
- [ ] Affichage des clips generes + Virality Score
- [ ] Download MP4

### Sprint 2 (Semaines 3-4) — Captions & Polish
- [ ] Sous-titres karaoke animes
- [ ] Templates de captions (5 styles)
- [ ] Timeline editor basique (trim/cut)
- [ ] Import par URL (YouTube, TikTok)
- [ ] Remake This button
- [ ] Auth + comptes utilisateurs

### Sprint 3 (Semaines 5-6) — Trending Dashboard
- [ ] Workflow Hunter (scraping tendances)
- [ ] Dashboard trending avec filtres niche
- [ ] Velocity Score
- [ ] 1 clic remontage split-screen
- [ ] Credit Manager integre

### Sprint 4 (Semaines 7-8) — Branding & Export
- [ ] Brand templates (logo, couleurs, fonts)
- [ ] Intro/Outro custom
- [ ] Filler word removal
- [ ] Auto-reframe multi-format
- [ ] Batch operations
- [ ] Systeme de paiement (Stripe)

### Sprint 5 (Semaines 9-10) — Distribution
- [ ] OAuth TikTok + Instagram + YouTube
- [ ] Publication 1 clic multi-plateforme
- [ ] Scheduling + calendrier
- [ ] Captions adaptees par plateforme
- [ ] Analytics basiques

---

## SECTION 9 — CE QU'IL FAUT PREPARER MAINTENANT

### Comptes a creer
1. **Supabase** → projet + cles API (URL, anon key, service role key)
2. **Anthropic** → cle API Claude
3. **OpenAI** → cle API (pour Whisper)
4. **n8n Cloud** OU serveur avec n8n self-hosted
5. **Vercel** → pour deployer le frontend
6. **GitHub** → repo pour le code
7. **Stripe** → pour les paiements (plus tard)
8. **ElevenLabs** → cle API (plus tard)

### Outils a installer sur le serveur
- FFmpeg
- yt-dlp
- Node.js 20+
- Python 3.11+ (pour scripts utilitaires)

---

*Document genere le 23 mars 2026 — Viral Animal v1.0*
