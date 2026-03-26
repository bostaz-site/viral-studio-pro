#!/usr/bin/env python3
"""
Generateur de contenu promotionnel multi-format — Viral Studio Pro
Usage : python3 promo_video.py <URL_YOUTUBE>
Variables requises : ANTHROPIC_API_KEY
"""

import sys
import os
import json
import re
from urllib import request, error


def scrape_youtube_meta(url: str) -> dict:
    """Scrape les metadonnees d'une video YouTube."""
    if "youtu.be/" in url:
        video_id = url.split("youtu.be/")[1].split("?")[0]
        url = f"https://www.youtube.com/watch?v={video_id}"

    req = request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    })

    try:
        with request.urlopen(req, timeout=15) as response:
            html = response.read().decode("utf-8", errors="replace")
    except Exception as e:
        print(f"Erreur lors du scraping : {e}")
        return {"title": None, "description": None}

    # Extraire le titre
    title = None
    title_match = re.search(r'"title"\s*:\s*"([^"]+)"', html)
    if title_match:
        title = title_match.group(1)
    else:
        og_match = re.search(r'<meta property="og:title" content="([^"]+)"', html)
        if og_match:
            title = og_match.group(1)

    # Extraire la description
    description = None
    desc_match = re.search(r'"shortDescription"\s*:\s*"((?:[^"\\]|\\.)*)"', html)
    if desc_match:
        description = desc_match.group(1).replace("\\n", "\n").replace('\\"', '"')
    else:
        og_desc = re.search(r'<meta property="og:description" content="([^"]+)"', html)
        if og_desc:
            description = og_desc.group(1)

    return {"title": title, "description": description}


def generate_promo(title: str, description: str, url: str) -> str:
    """Appelle Claude API pour generer le contenu promo multi-format."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("Erreur : La variable d'environnement ANTHROPIC_API_KEY n'est pas configuree.")
        print("Recupere ta cle sur console.anthropic.com -> API Keys -> Create Key")
        sys.exit(1)

    prompt = f"""Tu es un expert en promotion de contenu video sur les reseaux sociaux.
Style : francais, direct, ton authentique. FOMO sans etre racoleur, pas de jargon marketing creux.

A partir de ces infos, genere 3 formats promotionnels en une seule reponse :

Titre de la video : {title}
Description : {description or 'Non disponible'}
URL : {url}

Genere exactement ces 3 sections avec des separateurs ===== entre chaque :

===== STORY INSTAGRAM =====
5 slides :
- Slide 1 : Hook (question percutante ou stat choc)
- Slide 2 : Le probleme que regle la video
- Slide 3 : Ce que tu vas decouvrir (teaser sans spoiler)
- Slide 4 : Preuve / legitimite / resultat
- Slide 5 : CTA clair ("Lien en bio", "Swipe up", etc.)
Pour chaque slide : indique le texte overlay ET le type de fond recommande (couleur unie, screenshot, etc.)

===== TELEGRAM =====
Message de 400-600 caracteres avec :
- Emojis pertinents
- Line breaks pour la lisibilite
- Le lien direct en fin de message
- Ton communautaire (comme si tu parlais a tes potes)

===== SCRIPT REEL =====
Script de 30-45 secondes avec timing :
[00-03s] Hook visuel + paroles exactes
[03-10s] Probleme pose
[10-25s] Teaser de la solution
[25-35s] CTA clair
Pour chaque segment : indique les paroles ET les captions/texte a afficher a l'ecran"""

    payload = {
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 1500,
        "messages": [{"role": "user", "content": prompt}]
    }

    data = json.dumps(payload).encode("utf-8")

    req = request.Request(
        "https://api.anthropic.com/v1/messages",
        data=data,
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=45) as response:
            result = json.loads(response.read().decode("utf-8"))
            text = result.get("content", [{}])[0].get("text", "")
            return text

    except error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        if e.code == 401:
            print("Erreur 401 : Cle API Anthropic invalide.")
        elif e.code == 429:
            print("Erreur 429 : Trop de requetes. Attends un moment.")
        else:
            print(f"Erreur API Anthropic {e.code} : {body}")
        sys.exit(1)


def show_help():
    """Affiche l'aide."""
    print("Generateur de contenu promo multi-format — Viral Studio Pro")
    print()
    print("Usage :")
    print("  python3 promo_video.py <URL_YOUTUBE>")
    print("  python3 promo_video.py --help")
    print()
    print("Genere 3 formats en une seule commande :")
    print("  A) 5 slides Story Instagram")
    print("  B) Message Telegram/Discord (400-600 chars)")
    print("  C) Script Reel 30-45 secondes avec timing")
    print()
    print("Variable d'environnement requise : ANTHROPIC_API_KEY")


if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] == "--help":
        show_help()
        sys.exit(0)

    url = sys.argv[1]

    print("Analyse de la video...")
    meta = scrape_youtube_meta(url)

    if meta["title"]:
        print(f"Titre detecte : {meta['title']}")
    else:
        print("Titre non detecte (video privee ?)")
        meta["title"] = input("Entre le titre manuellement : ").strip()
        if not meta["title"]:
            print("Erreur : un titre est necessaire.")
            sys.exit(1)

    print("Generation Story + Telegram + Reel...")
    promo = generate_promo(meta["title"], meta["description"], url)

    print()
    print("=" * 60)
    print("CONTENU PROMOTIONNEL GENERE")
    print("=" * 60)
    print()
    print(promo)
