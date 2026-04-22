---
name: description-youtube
description: "Genere une description YouTube SEO complete a partir d'une URL YouTube. Se declenche quand l'utilisateur dit 'genere la description youtube', 'description SEO', 'SEO youtube', 'je sors une video', ou fournit une URL youtube.com ou youtu.be."
---

# Description YouTube SEO — Viral Animal

## Objectif
A partir d'une URL YouTube, scrape les metadonnees de la video,
puis genere une description SEO complete et optimisee dans le style
direct et authentique de Viral Animal.

## Instructions

1. Verifier que ANTHROPIC_API_KEY est configuree
2. Lancer : `python3 scripts/yt_description.py [URL_YOUTUBE]`
3. Le script scrape la page YouTube pour extraire titre et description
4. Il appelle Claude API pour generer une description optimisee
5. La description generee contient :
   - Hook d'accroche (1-2 phrases visibles avant "voir plus")
   - Resume du contenu (3-5 lignes)
   - Ce que tu vas apprendre (liste a puces)
   - Chapitres avec timestamps (si disponibles dans la video)
   - 15 a 20 hashtags SEO pertinents

### Format de sortie
```
[Hook d'accroche forte]

[Resume du contenu]

CE QUE TU VAS APPRENDRE :
- Point 1
- Point 2
- Point 3

CHAPITRES :
00:00 Introduction
01:30 ...

#hashtag1 #hashtag2 ...
```

### Adaptation Viral Animal
- Le style est direct, francais, oriente croissance
- Les hashtags incluent des tags lies au viral/growth
- La description encourage l'engagement (like, commente, partage)
- Compatible avec le module Copywriter SEO du projet

## Contraintes
- Si la video est privee : demander le titre + resume manuellement
- Ne jamais afficher la cle API dans les logs
- Modules Python standard uniquement (urllib, json, sys, os, re)
- Le modele utilise est claude-sonnet-4-20250514
