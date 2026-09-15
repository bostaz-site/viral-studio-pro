# Todo — Permissions API (Social Media)

> Tout ce qui reste à faire manuellement pour que les apps soient prêtes à publier.

---

## TikTok (le plus de travail)

- [ ] Uploader l'icône app 1024x1024 (`viral_animal_icon.png` dans ce dossier)
- [ ] Remplir les infos de base :
  - Category : Entertainment
  - Description : "Viral Animal helps creators boost clip virality with smart editing tools"
  - Terms of Service URL : https://viralanimal.com/terms
  - Privacy Policy URL : https://viralanimal.com/privacy
  - Platform : Web
  - Website URL : https://viralanimal.com
- [ ] Vérifier le domaine : ajouter le DNS TXT record fourni par TikTok sur viralanimal.com (chez ton registrar)
- [ ] Ajouter le produit "Content Posting API"
- [ ] Ajouter les scopes : `video.publish` + `video.upload`
- [ ] Enregistrer une démo vidéo montrant le flow de l'app (screen recording ~1-2 min)
- [ ] Uploader la démo vidéo dans la section App Review
- [ ] Soumettre pour review

**Console :** https://developers.tiktok.com/app/7629746100858095637/pending

---

## Google / YouTube — DONE

- [x] Ajouter tes comptes Gmail comme "utilisateurs de test" (Auth Platform → Audience) — samycloutier30@gmail.com déjà ajouté
- [ ] Ajouter aussi les comptes warmup quand ils seront prêts
- [ ] Copier le Client Secret depuis la console et le mettre dans `.env.local` quand tu intègres YouTube

**Console :** https://console.cloud.google.com/auth/clients?project=viral-animal

---

## Meta / Instagram — DONE (permissions ajoutées)

- [x] Permissions ajoutées : `instagram_basic`, `instagram_business_basic`, `instagram_business_content_publish` — toutes "Prête pour le test"
- [x] Pages Terms of Service et Privacy Policy déjà créées sur le site
- [ ] Soumettre l'app pour App Review quand prêt

**Console :** https://developers.facebook.com/apps/2013402156195862/use_cases/

---

## Pages sur le site — DONE

- [x] `/terms` — Page Conditions d'utilisation (existe déjà)
- [x] `/privacy` — Page Politique de confidentialité (existe déjà)

---

## Snapchat

Skippé — ROI trop faible pour le moment.

---

*Dernière mise à jour : 17 avril 2026*
