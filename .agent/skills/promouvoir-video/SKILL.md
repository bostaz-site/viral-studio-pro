---
name: promouvoir-video
description: "Cree du contenu promotionnel multi-format depuis une URL YouTube. Se declenche quand l'utilisateur dit 'promouvoir ma video', 'annoncer une video', 'story youtube', 'reel d'annonce', 'post telegram', 'post instagram', ou donne une URL YouTube en voulant la promouvoir."
---

# Promouvoir une video — Viral Studio Pro

## Objectif
A partir d'une URL YouTube, genere en une seule fois 3 formats promotionnels :
- 5 slides de Story Instagram (texte overlay + fond recommande)
- Un message Telegram/Discord pret a copier (400-600 chars)
- Un script de Reel d'annonce de 30-45 secondes

Ideal pour la distribution multi-plateforme des clips generes par Viral Studio Pro.

## Instructions

1. Verifier que ANTHROPIC_API_KEY est configuree
2. Lancer : `python3 scripts/promo_video.py [URL_YOUTUBE]`
3. Le script scrape les metadonnees YouTube
4. Il appelle Claude API pour generer les 3 formats d'un coup
5. La sortie affiche les 3 formats avec des separateurs clairs

### Format A — Story Instagram (5 slides)
```
Slide 1 : Hook (question ou stat choc)
Slide 2 : Le probleme que regle la video
Slide 3 : Ce que tu vas decouvrir (teaser)
Slide 4 : Preuve / legitimite
Slide 5 : CTA (va regarder la video)
→ Pour chaque slide : texte overlay + indication de fond
```

### Format B — Message Telegram/Discord
```
400-600 chars avec emojis et line breaks
Lien direct en fin de message, ton communautaire
```

### Format C — Script Reel 30-45 secondes
```
[00-03s] Hook visuel + paroles
[03-10s] Probleme pose
[10-25s] Teaser de la solution
[25-35s] CTA clair
→ Paroles + captions a afficher a l'ecran pour chaque segment
```

### Adaptation Viral Studio Pro
- Le style est direct, francais, authentique, pas de jargon marketing creux
- FOMO sans etre racoleur
- Les formats sont optimises pour les algorithmes de chaque plateforme
- Compatible avec le module Distribution (Module 5) du projet

## Contraintes
- Ne jamais afficher la cle API dans les logs
- Modules Python standard uniquement
- Si video privee : demander titre + resume manuellement
- Pas de jargon marketing creux
