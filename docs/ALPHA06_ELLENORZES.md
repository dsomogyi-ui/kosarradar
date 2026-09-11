# Alpha 0.6 ellenőrzés – 2026-09-11

- 20/20 automatikus teszt sikeres: árlogika, pontos kiszerelés, betétdíj, hűségár, hiányos kosár, forráscache, négy láncra szűrés, kategóriafa, lapozás, fiókadat-validálás és same-origin ellenőrzés.
- TypeScript ellenőrzés és Next.js production build sikeres.
- npm audit --omit=dev: 0 ismert sérülékenység.
- Élő GVH próba: négy lánc, 631 üzlet, 9 főkategória, almalé első oldalán 14 támogatott termék. A kiválasztott miskolci Auchan üzletekkel Cappy 100% almalé 1 l: normál kosár 999 Ft, hűségárral 749 Ft a próba idején. Más lánchoz tartozó üzlet szerveroldalon elutasítva.
- Az élő eredmény pontos időpontja: `alpha06-live-check.json`. Ezek nem állandó ajánlati árak.
- Böngészős végponttól végpontig ellenőrzés nem történt.
- Supabase éles projekt, RLS kétfiókos próba, levelek kézbesítése, Google/Facebook OAuth kör és többeszközös szinkron még nincs élőben ellenőrizve. A sémában a saját rekordra korlátozott RLS és a szerver hitelesített user_id használata kódellenőrzést kapott; ez nem helyettesíti a célprojektben futtatott tesztet.
