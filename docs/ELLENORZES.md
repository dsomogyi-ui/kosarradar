# Ellenőrzési jegyzőkönyv – Alpha 0.5

Dátum: 2026-09-11.

- 16 automatikus teszt sikeres: számítás, teljes és hiányos kosár, hűségár, visszaváltási díj, darabszám, pontos kiszerelés, 1/2/3 üzlet, elavult adatok, helyi mentés, bemeneti ellenőrzés, vonalkód, régi API kivezetése.
- A termelési függőségeken futtatott `npm audit --omit=dev` 0 ismert sérülékenységet jelzett. Ez csomagadatbázis-alapú ellenőrzés, nem teljes biztonsági audit.
- A TypeScript-ellenőrzés és a Next.js termelési build sikeres.
- Valódi külső adatkapcsolat: a GVH lánc- és üzletlistája, név szerinti termékkeresése, termékrészlete és több üzletet egyszerre lekérő árvégpontja válaszolt.
- Az alkalmazás saját `compare` függvénye élő GVH-lekérésekkel hibamentesen lefutott. A próbában 1 pontosan azonos termék szerepelt 3 kiválasztott üzletben. Az élő ellenőrzés nem bizonyítja minden termék és mind a 9 lánc összes árának hibátlanságát.

## Az élő próba eredménye

Perwoll Color, 75 mosás, 3,75 l; azonosító: 9000101810325. Lekérés: 2026-09-11, 09:23 UTC körül. Hűségkedvezmény nélkül, 1 csomag.

| Üzlet | Visszakapott ár | Állapot |
|---|---:|---|
| Auchan, Budapest, Szentendrei út 115. | 7 199 Ft | sikeres |
| Rossmann, Budapest, Lövőház utca 2–6. | 7 333 Ft | sikeres |
| Tesco, Budapest, Bécsi út 258. | 8 590 Ft | sikeres |

A számítás az Auchan üzletet választotta 7 199 Ft-tal. A gépi eredmény az `elo_proba_2026-09-11.json` fájlban található. Ezek dátummal ellátott ellenőrzési adatok, nem mai árígéretek; a felület nem olvassa ezt a fájlt.

## Az ellenőrzés határa

Nem történt böngészős / vizuális / végponttól végpontig felületi teszt, és nem történt nyilvános Vercel-telepítés. A tesztek nem igazolnak bolti készletet, teljes választéklefedettséget vagy üzemi API-felhasználási megállapodást.
