# PROMPT — Fix les 2 derniers points

---

Le projet compile avec 0 erreurs TS et le build passe. Il reste 2 points à régler :

## 1. Régénérer les types Supabase

Les routes affiliés utilisent `as any` parce que la table `affiliate_codes` n'est pas dans les types générés. Régénère les types :

```bash
npx supabase gen types typescript --project-id <PROJECT_ID> > types/supabase.ts
```

Le project ID est dans le SUPABASE_URL (le sous-domaine). Après ça, remplace les `as any` dans ces fichiers par les bons types :
- `app/api/affiliates/` (tous les fichiers)
- `app/(dashboard)/admin/affiliates/page.tsx`
- Tout autre fichier qui utilise `as any` sur des queries Supabase

Vérifie avec `npx tsc --noEmit` que ça compile toujours.

## 2. Vérifier que le VPS communique bien avec l'API

Le VPS Railway envoie des webhooks à l'API Next.js quand un render est terminé. Vérifie que :

1. Le VPS a bien les bonnes env vars :
   - `SUPABASE_URL` (pas `NEXT_PUBLIC_SUPABASE_URL`)
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Vérifie dans `vps/lib/supabase-client.js` que les noms matchent

2. L'API route `/api/render/status` (ou le webhook callback) accepte les requêtes du VPS :
   - Vérifie le header d'authentification (`VPS_RENDER_API_KEY` ou HMAC)
   - Vérifie que la réponse du polling (`GET /api/render/status?jobId=X`) retourne le bon format

3. Lis `vps/routes/render.js` et trace le flow complet :
   - Comment le VPS reçoit la requête de render
   - Comment il met à jour le status dans la DB (`updateRenderJob`)
   - Comment il upload vers Supabase Storage (`uploadClip`)
   - Comment le client Next.js poll le status

Documente toute incohérence trouvée et fixe-la.

Après les fixes, relance `npx tsc --noEmit` et `npx next build` pour confirmer que tout passe encore.
