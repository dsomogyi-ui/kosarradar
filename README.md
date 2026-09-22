# KosárRadar Alpha 0.9

Menthető, pontos termékekből álló bevásárlókosár, kedvenc Auchan/Tesco üzletek, üzletenkénti árfigyelés és a teljes utazási költséggel számoló ajánlás.

## Használható funkciók

- Szabad szöveges lista, konkrét termék és kiszerelés kiválasztásával; név-, kategória- és vonalkódkeresés.
- Kosarak mentése és visszanyitása. Vendégként az adott böngészőben, konfigurált fiókkal saját felhős rekordokban.
- Település és 1–100 km légvonalbeli körzet; Auchan/Tesco üzletek, csillagozható kedvencek, minden kijelölt üzlet ára.
- Helyi árfigyelési listák és régi/új árjelzések. Nyitott, látható appban futnak; bezárt app mellett nem.
- Jármű, fogyasztás, energiaár, egyéb Ft/km, parkolás és minimummegtakarítás. Kézi úthosszal működő költségkalkulátor.

## Aktiválásra vár

Az automatikus közúti útvonalhoz `ORS_API_KEY` kell. A kész számítás minden megengedett 1–3 üzletes útvonalat összevet, legfeljebb 8 kijelölt boltból, hazaúttal együtt.

A háttérfigyelés workerje, értesítési API-ja, adatbázissémája és napi production ütemezése elkészült, de **nincs aktiválva**. A meglévő Supabase projekt 2026-09-22-én inaktív, az új SQL nincs alkalmazva; a Vercel projektbeállításaihoz a connector nem fér hozzá. Push/e-mail nincs. A meglévő AI-értelmezés is opcionális, konfigurált szerveroldali kulcsot igényel.

[Részletes működés, korlátok és aktiválás](docs/ALPHA09_ARFIGYELES_ES_UT.md) · [Kosár és körzet](docs/ALPHA08_KOSAR_ES_KORZET.md) · [Fiókbeállítás](docs/FIOK_BEALLITAS.md)

## Futtatás

Node >=22.18.0. `npm ci`, majd `npm run dev`. Környezeti minta: `.env.example`. Ellenőrzés: `npm test`, `npm run typecheck`, `npm run build`.

## Árforrás és számítás

GVH Árfigyelő: pontos termékazonosító, kiszerelés, üzletenkénti ár, opt-in hűségár és visszaváltási díj. Legfeljebb 24 termék. Árlekérés nyolcas üzletcsoportokban; az árlistához több üzlet is kijelölhető. Az útiköltség nélküli nézet 1–2 boltot, a konfigurált útvonaltervező 1–3 boltot vizsgál. Kimért termék, egyéni kupon és készletigazolás nem támogatott. Hiányzó vagy elavult ár nem válik ingyenes vagy teljes kosárrá.
