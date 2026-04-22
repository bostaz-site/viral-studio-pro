#!/usr/bin/env python3
"""
Generateur de descriptions YouTube SEO — Viral Animal
Usage : python3 yt_description.py <URL_YOUTUBE>
Variables requises : ANTHROPIC_API_KEY
"""

import sys
import os
import json
import re
from urllib import request, error, parse


def scrape_youtube_meta(url: str) -> dict:
    """Scrape les metadonnees d'une video YouTube."""
    # Normaliser l'URL
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
        print(f"Erreur lors du scraping de la page YouTube : {e}")
        return {"title": None, "description": None, "chapters": None}

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

    # Extraire les chapitres (timestamps dans la description)
    chapters = None
    if description:
        chapter_pattern = re.findall(r'(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–]?\s*(.+)', description)
        if chapter_pattern:
            chapters = [{"time": t, "title": label.strip()} for t, label in chapter_pattern]

    return {
        "title": title,
        "description": description,
        "chapters": chapters
    }


def generate_description(title: str, description: str, chapters: list = None) -> str:
    """Appelle Claude API pour generer une description SEO."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("Erreur : La variable d'environnement ANTHROPIC_API_KEY n'est pas configuree.")
        print("Recupere ta cle sur console.anthropic.com -> API Keys -> Create Key")
        sys.exit(1)

    chapters_text = ""
    if chapters:
        chapters_text = "\n\nChapitres detectes :\n"
        for ch in chapters:
            chapters_text += f"  {ch['time']} - {ch['title']}\n"

    prompt = f"""Tu es un expert SEO YouTube pour une chaine tech/business qui cree du contenu viral.
Style : francais, direct, ton authentique. FOMO sans etre racoleur, pas de jargon marketing creux.

A partir de ces infos, genere une description YouTube complete et optimisee :

Titre : {title or 'Non disponible'}
Description originale : {description or 'Non disponible'}
{chapters_text}

Genere dans cet ordre exact :
1. Hook d'accroche (1-2 phrases AVANT le "voir plus" — max 150 chars, doit donner envie de lire la suite)
2. Resume du contenu (3-5 lignes)
3. Section "CE QUE TU VAS APPRENDRE" avec 3-5 points cles
4. Chapitres avec timestamps (reprends ceux detectes ou invente-en si absents)
5. 15-20 hashtags SEO pertinents tries par pertinence

Utilise des separateurs visuels (===== ou -----) entre les sections.
Ajoute des emojis pertinents mais sans exagerer."""

    payload = {
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 1200,
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
        with request.urlopen(req, timeout=30) as response:
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
    print("Generateur de descriptions YouTube SEO — Viral Animal")
    print()
    print("Usage :")
    print("  python3 yt_description.py <URL_YOUTUBE>")
    print("  python3 yt_description.py --help")
    print()
    print("Exemples :")
    print("  python3 yt_description.py https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    print("  python3 yt_description.py https://youtu.be/dQw4w9WgXcQ")
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

    print("Generation en cours...")
    description = generate_description(
        meta["title"],
        meta["description"],
        meta["chapters"]
    )

    print()
    print("=" * 60)
    print("DESCRIPTION YOUTUBE SEO GENEREE")
    print("=" * 60)
    print()
    print(description)
