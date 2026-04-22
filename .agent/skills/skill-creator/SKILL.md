---
name: creer-skill
description: "Cree des Skills pour Viral Animal. Utiliser des que l'utilisateur mentionne : creer un skill, automatiser une tache, construire un outil agent, creer une commande, ou modifier un skill existant."
---

# Createur de Skills Viral Animal

## Structure officielle d'un skill

.agent/skills/nom-du-skill/   (workspace — dossier projet)
├── SKILL.md          (Obligatoire)
├── scripts/          (Optionnel — Python, Bash, Node)
├── references/       (Optionnel — docs, templates)
└── assets/           (Optionnel — fichiers statiques)

## Frontmatter YAML — regles strictes

- name : facultatif. Lettres minuscules + tirets uniquement.
  Si absent, le nom du dossier est utilise.
- description : OBLIGATOIRE. Phrase de declenchement semantique.
  A la 3e personne. Max 1024 chars. Doit etre precise.
  Mauvais : 'Outils video'
  Bon    : 'Decoupe une video longue en clips courts optimises
            pour TikTok/Reels avec sous-titres karaoke et
            score viral via FFmpeg et Claude API'

## Corps SKILL.md — 4 sections

1. Objectif : ce que permet le skill (1-3 phrases)
2. Instructions : logique etape par etape
3. Exemples (optionnel) : paires input -> output pour guider
4. Contraintes : regles a ne jamais violer

## Principes de redaction

- Concision : l'agent est intelligent. Ne pas expliquer l'evident.
- Sous 500 lignes. Si plus de detail -> pointer vers references/
- Chemins : toujours /, jamais \
- Degre de liberte :
  Haute   -> Points de liste (heuristiques, choix laisses a l'agent)
  Moyenne -> Blocs de code (templates a remplir)
  Faible  -> Commandes bash exactes (operations fragiles)

## Workflow de creation d'un nouveau skill

- [ ] Definir : que fait le skill ? Quand se declenche-t-il ?
- [ ] Choisir l'emplacement : .agent/skills/ (workspace)
- [ ] Rediger le frontmatter YAML (description precise)
- [ ] Rediger le corps (objectif + instructions + contraintes)
- [ ] Creer les scripts necessaires dans scripts/
- [ ] Tester avec 2-3 prompts reels differents
- [ ] Affiner la description si le declenchement est imprecis

## Gestion des erreurs dans les scripts

Les scripts sont des boites noires pour l'utilisateur.
En cas de doute, lancer : python3 scripts/nom-script.py --help
Toujours gerer les erreurs avec des messages clairs.

## Template de sortie

### Nom du dossier
.agent/skills/{nom-avec-tirets}/ (tout minuscule)

### SKILL.md
---
name: [nom-avec-tirets]
description: "[3e personne. Declencheurs tres explicites. Max 1024 chars.]"
---
# [Titre du Skill]

## Objectif
[Ce que permet le skill en 1-3 phrases]

## Instructions
1. [Etape 1]
2. [Etape 2]

## Contraintes
- [Ne jamais faire X]

## Contexte Viral Animal

Ce skill creator est adapte au projet Viral Animal.
Les skills crees doivent s'integrer avec la stack existante :
- Next.js 14 (App Router) + TypeScript
- Supabase (PostgreSQL + Storage + Auth)
- FFmpeg pour le montage video
- Claude API (Anthropic) pour l'intelligence
- yt-dlp pour le telechargement
- n8n pour l'orchestration des workflows

Les variables d'environnement disponibles :
- ANTHROPIC_API_KEY
- NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- OPENAI_API_KEY
- TAAPIT_API_KEY
- TALLY_API_KEY
- N8N_BASE_URL / N8N_API_KEY
