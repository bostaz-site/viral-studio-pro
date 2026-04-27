# PROMPT — Réparer les fichiers tronqués

Copie-colle ce prompt dans Claude Code.

---

## Contexte

Plusieurs fichiers du projet sont **tronqués** — ils se terminent au milieu d'une ligne, sans les accolades/parenthèses fermantes. C'est probablement causé par OneDrive sync. Le code source complet existe dans l'historique git (le dernier commit a les versions complètes).

## Ce que tu dois faire

### Étape 1 — Scanner TOUS les fichiers source

Parcours chaque fichier `.ts`, `.tsx`, `.js`, `.mjs` du projet (SAUF `node_modules/`) et vérifie :

1. **Null bytes** — le fichier contient des `\x00` (octets nuls)
2. **Troncation** — le fichier ne se termine pas correctement :
   - Les fichiers `.ts`/`.tsx` doivent se terminer par `}` ou `export` suivi d'un newline
   - Les fichiers ne doivent PAS se terminer au milieu d'un string, d'un attribut JSX, ou d'une expression
3. **Taille** — compare la taille du fichier sur disque avec la version git (`git show HEAD:"path/to/file" | wc -c`). Si la version disque est plus petite que la version git, le fichier est probablement tronqué.

Script de détection à exécuter :

```bash
#!/bin/bash
# Détecte les fichiers tronqués en comparant avec git
echo "=== Fichiers tronqués (plus petits que dans git) ==="
git ls-files -- '*.ts' '*.tsx' '*.js' '*.mjs' | while read f; do
  git_size=$(git show HEAD:"$f" 2>/dev/null | wc -c)
  disk_size=$(wc -c < "$f" 2>/dev/null)
  if [ "$git_size" -gt 0 ] && [ "$disk_size" -lt "$git_size" ]; then
    echo "TRUNCATED: $f (disk=${disk_size}b vs git=${git_size}b, missing $((git_size - disk_size))b)"
  fi
done

echo ""
echo "=== Fichiers avec null bytes ==="
git ls-files -- '*.ts' '*.tsx' '*.js' '*.mjs' | while read f; do
  if grep -Pl '\x00' "$f" 2>/dev/null; then
    echo "NULL BYTES: $f"
  fi
done
```

### Étape 2 — Restaurer depuis git

Pour chaque fichier tronqué trouvé :

```bash
git show HEAD:"chemin/du/fichier" > /tmp/restore.tmp
cp /tmp/restore.tmp "chemin/du/fichier"
```

**IMPORTANT** : Certains fichiers ont des modifications INTENTIONNELLES qui n'ont pas encore été committées. Avant de restaurer, vérifie si le fichier a des changements staged ou unstaged avec `git diff HEAD -- "fichier"`. Si oui, note les changements, restaure la version git, puis réapplique les modifications manuellement.

Les fichiers avec des modifications intentionnelles connues :
- `app/(dashboard)/dashboard/enhance/[clipId]/page.tsx` — ajout de `bassBoost: 'off'`, `speedRamp: 'off'` dans DEFAULT_SETTINGS + `hasUserChangedSettings` useRef + refonte boutons Generate/Download/Publish
- `app/(dashboard)/layout.tsx` — remplacement de `isAdminEmail` import par fetch `/api/auth/me`
- `app/(dashboard)/admin/affiliates/page.tsx` — remplacement de `isAdminEmail` par fetch `/api/auth/me`
- `lib/auth/admin-emails.ts` — `NEXT_PUBLIC_ADMIN_EMAILS` → `ADMIN_EMAILS`
- `vps/lib/supabase-client.js` — retry 3x + logs détaillés sur uploadToStorage

### Étape 3 — Vérifier

Après restauration :

```bash
# Vérifier qu'il n'y a plus de fichiers tronqués
git ls-files -- '*.ts' '*.tsx' '*.js' '*.mjs' | while read f; do
  git_size=$(git show HEAD:"$f" 2>/dev/null | wc -c)
  disk_size=$(wc -c < "$f" 2>/dev/null)
  if [ "$git_size" -gt 0 ] && [ "$disk_size" -lt "$git_size" ]; then
    echo "STILL BROKEN: $f"
  fi
done

# Vérifier que TypeScript compile
npx tsc --noEmit 2>&1 | head -30
```

### Étape 4 — Rapport

Liste-moi :
1. Combien de fichiers étaient tronqués
2. Lesquels ont été restaurés
3. Lesquels avaient des modifications intentionnelles qu'il a fallu réappliquer
4. Le résultat de `npx tsc --noEmit` après restauration
