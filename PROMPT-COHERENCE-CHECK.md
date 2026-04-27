# PROMPT — Vérification de cohérence du projet

Copie-colle ce prompt dans Claude Code.

---

## Contexte

Le projet Viral Animal a été développé sur plusieurs sessions avec beaucoup de changements rapides. Plusieurs fichiers ont été tronqués par OneDrive sync et restaurés depuis git, puis des modifications ont été réappliquées manuellement. Je veux m'assurer que TOUT s'agence correctement — aucun import cassé, aucune référence à du code qui n'existe plus, aucune incohérence entre les fichiers.

## Ce que tu dois faire

### Étape 0 — Restaurer les fichiers tronqués

AVANT TOUT, exécute ce script pour trouver et restaurer les fichiers tronqués :

```bash
git ls-files -- '*.ts' '*.tsx' '*.js' '*.mjs' | while read f; do
  [[ "$f" == *node_modules* ]] && continue
  git_size=$(git show HEAD:"$f" 2>/dev/null | wc -c)
  disk_size=$(wc -c < "$f" 2>/dev/null || echo 0)
  if [ "$git_size" -gt 0 ] && [ "$disk_size" -lt "$git_size" ]; then
    echo "TRUNCATED: $f (disk=${disk_size} vs git=${git_size})"
    git show HEAD:"$f" > "$f"
    echo "  -> Restored from git"
  fi
done
```

Puis réapplique ces modifications qui ne sont pas encore dans git :

**enhance/[clipId]/page.tsx :**
- `showEnhancements` initialisé à `false` (pas `true`)
- `hasUserChangedSettings = useRef(false)` déclaré après `pollRef`
- DEFAULT_SETTINGS inclut `bassBoost: 'off'` et `speedRamp: 'off'`
- `updateSetting` a le bloc `hasUserChangedSettings` qui auto-switch vers Enhanced
- Le toggle preview a 3 boutons : Original / Enhanced / Rendered (Rendered visible seulement si `renderDownloadUrl`)
- LivePreview reçoit `videoUrl={isRenderedVideo ? videoUrl : (originalVideoUrl ?? videoUrl)}`
- Quand le render finit (polling `done`), `isRenderedVideo` n'est PAS mis à `true` automatiquement — le user reste en Enhanced
- Le bouton Generate est caché quand `makeViralLoading || rendering || renderDownloadUrl`
- Les boutons Publish (gros, violet, en premier) + Download (petit, gris, en dessous) + Reset apparaissent quand `makeViralLoading || rendering || renderDownloadUrl`
- Download est disabled/gris tant que `renderDownloadUrl` est null

**layout.tsx :**
- L'import `isAdminEmail` est SUPPRIMÉ
- `isAdmin` est un `useState(false)` au lieu d'un appel direct
- Le check admin se fait via `fetch('/api/auth/me')`

**admin/affiliates/page.tsx :**
- Même chose — `isAdminEmail` remplacé par `fetch('/api/auth/me')`

**lib/auth/admin-emails.ts :**
- `NEXT_PUBLIC_ADMIN_EMAILS` → `ADMIN_EMAILS` (env var server-only)

**vps/lib/supabase-client.js :**
- `uploadToStorage` a un retry 3x avec logs détaillés (taille fichier, bucket, statusCode, JSON complet de l'erreur)

**app/api/auth/me/route.ts :**
- Nouveau fichier — `GET` qui retourne `{ isAdmin: boolean }` via `isAdminEmail` côté serveur

### Étape 1 — Vérification des imports

Pour CHAQUE fichier `.ts` et `.tsx` (hors node_modules), vérifie :
- Tous les imports pointent vers des fichiers qui existent
- Tous les imports de fonctions/types correspondent à des exports réels dans le fichier cible
- Pas d'import de `isAdminEmail` dans des fichiers client (`'use client'`)
- Pas d'import de modules supprimés ou renommés

```bash
# Trouver les imports cassés
npx tsc --noEmit 2>&1 | grep -E "Cannot find module|has no exported member|Module.*has no default export" | sort -u
```

### Étape 2 — Vérification des types

```bash
npx tsc --noEmit 2>&1 | head -50
```

Pour CHAQUE erreur TypeScript :
- Identifie la cause
- Fixe-la
- Si c'est un fichier tronqué qui n'a pas été détecté à l'étape 0, restaure-le d'abord

L'objectif est **zéro erreur TypeScript** (ou seulement des erreurs dans des fichiers non-critiques qui ne bloquent pas le build Next.js).

### Étape 3 — Vérification de cohérence cross-fichiers

Vérifie ces connexions critiques :

**A. Enhance page ↔ Scoring**
- `DEFAULT_SETTINGS` dans la page enhance a TOUTES les propriétés de `EnhanceSettings` dans `lib/enhance/scoring.ts`
- `computeCurrentScore()` gère tous les settings sans crasher sur `undefined`
- `computeBaselineScore()` retourne un score valide
- `getRealImpact()` (si elle existe) utilise les mêmes noms de catégories que le JSX

**B. Enhance page ↔ LivePreview**
- Les props passées à `<LivePreview>` matchent l'interface du composant
- `showEnhancements`, `isRenderedVideo`, `videoUrl` sont cohérents dans tous les cas :
  - Initial (aucune option) : Original sélectionné, pas d'overlays
  - Options choisies : Enhanced sélectionné, overlays CSS
  - Render en cours : Enhanced, overlays CSS, boutons disabled
  - Render terminé : Enhanced par défaut, bouton Rendered disponible
  - User clique Rendered : vidéo baked, pas d'overlays

**C. Enhance page ↔ API render**
- `handleRender()` envoie un payload compatible avec ce que `/api/render/route.ts` attend (schema Zod)
- Le schema Zod dans `lib/schemas/render.ts` inclut `bassBoost` et `speedRamp`
- `/api/render/route.ts` forward correctement au VPS Railway

**D. Layout ↔ Auth**
- `layout.tsx` n'importe plus `isAdminEmail` directement
- `/api/auth/me` existe et fonctionne
- La navigation admin s'affiche seulement pour les admins
- Les pages admin (`admin/affiliates`, `admin/growth`, `admin/streamers`) vérifient l'auth correctement

**E. VPS ↔ Supabase**
- `vps/lib/supabase-client.js` — `uploadToStorage` a le retry
- Les buckets référencés (`clips`, `thumbnails`, `videos`, `brand-assets`) sont cohérents entre le VPS et les API routes Next.js
- `vps/routes/render.js` appelle `uploadClip` et `uploadThumbnail` correctement

**F. Store Zustand ↔ Pages**
- `stores/trending-store.ts` — les actions et selectors utilisés dans `dashboard/page.tsx` existent
- `stores/account-store.ts` — utilisé dans `layout.tsx` et `settings/page.tsx` correctement

**G. Env vars**
- Toutes les env vars utilisées dans le code sont documentées dans CLAUDE.md
- `ADMIN_EMAILS` (pas `NEXT_PUBLIC_ADMIN_EMAILS`) est utilisé côté serveur uniquement
- Aucun `process.env.NEXT_PUBLIC_ADMIN_EMAILS` ne reste dans le code

### Étape 4 — Build test

```bash
npx next build 2>&1 | tail -40
```

Le build Next.js doit réussir. Si des erreurs apparaissent :
- Fixe-les
- Relance le build
- Répète jusqu'à ce que ça passe

### Étape 5 — Rapport final

Donne-moi :

1. **Fichiers restaurés** — liste des fichiers tronqués trouvés et restaurés
2. **Erreurs TS fixées** — liste de chaque erreur et ce que tu as fait
3. **Incohérences trouvées** — imports cassés, types manquants, références mortes
4. **Build status** — est-ce que `next build` passe ?
5. **Confiance** — sur 100, à quel point tu es confiant que tout s'agence bien

## Règles

- NE SAUTE PAS d'étapes. Chaque vérification est importante.
- Si tu trouves un problème, FIXE-LE immédiatement avant de passer au suivant.
- Si un fix en casse un autre, itère jusqu'à stabilisation.
- Montre-moi le diff de chaque changement que tu fais.
- Ne supprime pas de fonctionnalité — si quelque chose semble mort, vérifie d'abord qu'il n'est pas utilisé dynamiquement.
