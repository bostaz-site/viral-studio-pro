# PROMPT — Audit complet Viral Animal

Copie-colle ce prompt dans Claude Code pour un audit en profondeur de ton projet.

---

Tu es un auditeur senior fullstack. Fais un audit COMPLET et BRUTAL du projet **Viral Animal** — une webapp Next.js 14 qui permet de booster la viralité de clips de streamers (sous-titres karaoké, split-screen, hook text, smart zoom) et de les exporter en format vertical 9:16.

## Ce que tu dois faire

### Étape 1 — Cartographie (READ ONLY, pas de changements)

Lis CLAUDE.md et SYSTEM-REFERENCE.md en entier pour comprendre l'architecture. Ensuite, explore systématiquement :

1. **Chaque API route** dans `app/api/` — lis chaque `route.ts` en entier
2. **Chaque page** dans `app/(dashboard)/` et `app/(auth)/` — lis chaque `page.tsx`
3. **Le serveur VPS** dans `vps/` — `server.js`, `routes/render.js`, `lib/ffmpeg-render.js`, `lib/subtitle-generator.js`
4. **Les libs critiques** — `lib/scoring/`, `lib/ai/`, `lib/twitch/`, `lib/kick/`, `lib/supabase/`, `lib/schemas/`
5. **Les stores Zustand** — `stores/`
6. **Les composants clés** — `components/enhance/`, `components/trending/`, `components/video/`
7. **La config** — `next.config.mjs`, `netlify.toml`, `middleware.ts`, `tailwind.config.ts`
8. **Les migrations Supabase** — `supabase/migrations/`

### Étape 2 — Audit par catégorie

Pour CHAQUE catégorie ci-dessous, donne :
- ✅ Ce qui est bien fait (avec fichier + ligne)
- ❌ Ce qui est cassé ou buggé (avec fichier + ligne + pourquoi)
- ⚠️ Ce qui est risqué / fragile (avec fichier + ligne + ce qui pourrait casser)
- 💡 Améliorations concrètes (avec priorité P0/P1/P2)

#### Catégories :

**A. Sécurité**
- Injection SQL, XSS, CSRF
- Validation des inputs (zod utilisé partout ?)
- Auth : middleware vérifie les routes protégées ?
- API keys exposées côté client ?
- RLS Supabase : toutes les tables protégées ?
- Rate limiting : toutes les routes sensibles couvertes ?
- CORS, headers de sécurité
- Le VPS Railway : authentification des requêtes ?

**B. Fiabilité / Bugs**
- Fichiers tronqués (vérifier que chaque fichier .ts/.tsx se termine correctement avec les accolades/parenthèses fermantes)
- Race conditions (render polling, state updates, cron jobs)
- Error handling : try/catch partout ? Errors silencieuses ?
- Memory leaks (intervals non nettoyés, subscriptions non fermées)
- Edge cases : que se passe-t-il si Supabase est down ? Si Railway est down ? Si Twitch API rate limit ?

**C. Performance**
- Bundle size : imports lourds côté client ?
- Requêtes DB : N+1 queries ? Index manquants ?
- Re-renders React inutiles ?
- Images/vidéos : lazy loading ? Optimisation ?
- API response times : queries lentes ?
- Caching : qu'est-ce qui est caché ? Qu'est-ce qui devrait l'être ?

**D. Architecture / Code Quality**
- Dead code (fonctions/composants/routes jamais utilisés)
- Duplication de code
- Fichiers trop gros (>500 lignes) qui devraient être split
- Types TypeScript : `any` utilisé ? Types manquants ?
- Séparation of concerns : logique business dans les composants UI ?
- Naming consistency
- Console.log en production ?

**E. UX / Product**
- Flow utilisateur : est-ce que le parcours clip → enhance → export est fluide ?
- Loading states : tous les états de chargement couverts ?
- Error states : messages d'erreur clairs pour l'utilisateur ?
- Mobile responsiveness (même si desktop-first)
- Accessibility basique (alt tags, aria labels, keyboard nav)
- Onboarding : un nouveau user comprend-il quoi faire ?

**F. Infrastructure / DevOps**
- Build : le projet compile sans erreurs ?
- Env vars : toutes documentées ? Fallbacks si manquantes ?
- Netlify config : redirects, headers, scheduled functions corrects ?
- Railway VPS : health check ? Auto-restart ? Logs ?
- Supabase : migrations à jour ? Fonctions RPC cohérentes ?
- Monitoring / alerting en place ?

**G. Le Pipeline Render (critique)**
- Le flow complet : API route → VPS → FFmpeg → Supabase Storage → retour client
- Les sous-titres karaoké : est-ce que le WordPop match entre preview CSS et rendu FFmpeg ?
- Split-screen : fonctionne avec tous les ratios ?
- Hook text + reorder : le "moment fort en premier" fonctionne ?
- Queue management : que se passe-t-il avec 10 renders simultanés ?
- Cleanup : les fichiers temporaires sont supprimés ?

### Étape 3 — Rapport final

Termine avec :

1. **Top 10 des problèmes critiques** (à fixer MAINTENANT avant de lancer)
2. **Top 10 des améliorations à haut impact** (effort faible, impact élevé)
3. **Score santé du projet** sur 100, décomposé :
   - Sécurité : /20
   - Fiabilité : /20
   - Performance : /15
   - Code Quality : /15
   - UX : /15
   - Infra : /15
4. **Plan d'action recommandé** : que faire dans les 7 prochains jours, dans l'ordre

## Règles

- Sois HONNÊTE et DIRECT. Pas de complaisance. Si c'est de la merde, dis-le.
- Chaque constat doit avoir un fichier et une ligne. Pas de généralités vagues.
- Ne change RIEN dans le code. C'est un audit READ-ONLY.
- Si un fichier semble tronqué (se termine au milieu d'une ligne sans accolade fermante), signale-le explicitement — c'est un problème réel de corruption de fichier.
- Priorise les problèmes qui empêchent les UTILISATEURS de faire ce qu'ils veulent (clip → enhance → export → download).
