# KosárRadar Alpha 0.5 – GVH-alapú kosár-összehasonlítás

A korábbi Alpha 0.4 Next.js projekt továbbfejlesztése. A csomag teljes forráskódot és telepítési leírást tartalmaz; a meglévő Vercel-alkalmazás helyére telepíthető. A tároló fő ágának frissítése a meglévő Vercel-telepítéseket indítja el.

## Mit tud ez a verzió?

- Termékkeresés a GVH Árfigyelőben, lapozással; vonalkód esetén pontos termékazonosító-lekérés.
- Konkrét üzletek választása település, irányítószám, cím és lánc alapján. Összehasonlításonként legfeljebb 8 üzlet, 24 különböző csomagolt termék, termékenként 1–99 csomag.
- Egy- és kétboltos teljes kosarak összehasonlítása, tételenkénti üzletkiosztással. A részleges kosár nem lehet teljes kosaras nyertes.
- Hűségárak lánconkénti, kifejezett választással; visszaváltási díj beszámítása.
- A második megálló általad megadott többletköltsége. Ez közös becslés minden kétboltos lehetőségre, nem útvonaltervezés. Az első bolt elérésének költsége nincs benne.
- A kosár és a választások mentése az adott böngészőben; nincs fiókok közti szinkronizálás.
- Elavult ár, hiányzó ár és lekérési hiba külön kezelése. Kosármódosításkor az előző eredmény azonnal érvénytelenné válik. Új keresés megszakítja a korábbi kérést.

## Indítás

Node.js 22.18 vagy újabb szükséges; az ellenőrzés Node.js 24 alatt történt.

```bash
npm ci
npm run dev
```

Az alkalmazást a konzolban jelzett helyi címen lehet megnyitni. A GVH-forrás alapértelmezetten engedélyezett; nem igényel API-kulcsot. A `.env.example` alapján opcionális `.env.local` készíthető. A `GVH_ENABLED=false` ideiglenesen kikapcsolja a forrást.

```bash
npm test
npm run typecheck
npm run build
npm start
```

Az élő, kis terjedelmű integrációs próba külön indul, nem része a hálózatfüggetlen teszteknek:

```bash
node --experimental-strip-types scripts/check-live.ts
```

Proxy mögötti Node.js 24 környezetben a már beállított `HTTP_PROXY`/`HTTPS_PROXY` használatához `NODE_USE_ENV_PROXY=1` szükséges lehet. A tanúsítvány-ellenőrzést nem kell és nem szabad kikapcsolni.

## Beépített API-k

| KosárRadar végpont | Feladat |
|---|---|
| `GET /api/shops` | GVH-láncok és üzletek normalizált listája |
| `GET /api/products/search?q=perwoll&offset=0` | 20 találat / oldal; 3–100 karakter; maximum 1000-es offset |
| `POST /api/compare` | Üzleti árlekérés és teljeskosár-számítás |
| `GET /api/prices/auchan`, `GET /api/perwoll` | Kivezetett HTML-árlekérők, HTTP 410 |

Példa a számítás kérésére:

```json
{
  "items": [{ "code": "9000101810325", "qty": 1 }],
  "shopIds": ["auchan-007", "rossmann-241", "tesco-1025"],
  "loyaltyChainIds": [],
  "extraStopCost": 0
}
```

A böngésző árakat, betétdíjat, üzletneveket és termékjellemzőket nem adhat meg a számításhoz: ezeket a szerver a forrásból tölti be. A termékazonosítókat szövegként kezeli, így a vezető nullák megmaradnak. Más kiszerelést nem helyettesít automatikusan.

## Lánconkénti állapot

| Lánc | Alpha 0.5 adatkapcsolat | Következő feladat |
|---|---|---|
| Auchan | Közös GVH-adapter | Közvetlen partnerkapcsolat csak további lefedettséghez/készlethez |
| Tesco | Közös GVH-adapter | Ugyanez; Clubcard csak kifejezett választással |
| Aldi | Közös GVH-adapter | A GVH-n kívüli választék külön forrást igényel |
| Lidl | Közös GVH-adapter | A GVH-n kívüli választék külön forrást igényel |
| dm | Közös GVH-adapter | A GVH-n kívüli választék/készlet külön forrást igényel |
| Rossmann | Közös GVH-adapter | A GVH-n kívüli választék/készlet külön forrást igényel |
| EcoFamily | Még nincs | Kereskedő által engedélyezett feed/API szükséges; UNAS-technológia önmagában nem hozzáférés |
| Spar, Penny, Müller | A közös GVH-adapterben szintén szerepel | Külön fejlesztés nélkül választhatók a GVH által lefedett termékeknél |

Az adapter nem jelent 9 külön, az üzletláncokkal kötött hivatalos API-integrációt. A GVH nyilvános felületének olvasási végpontjait használja. Nincs igazolt külső fejlesztői szerződés, SLA vagy teljes választéklefedettség. Üzemi felhasználás előtt a felhasználás és a terhelés feltételeit rendezni kell a forrással.

## Adatkezelés és korlátok

- Ár: 15 perces, keresési találat: 1 órás, üzletlista: 24 órás folyamaton belüli gyorsítótár. Maximum 600 bejegyzés, azonos folyamatban legfeljebb 12 egyidejű upstream kérés, egy kosárban 4 párhuzamos termékfeldolgozás. Kérésenként 15 másodperces időkorlát, automatikus ismétlés nélkül.
- A gyorsítótár a sikeres lekérés eredeti `observedAt` időpontját őrzi. Hiba esetén legfeljebb a TTL lejárta utáni 6 órában ad vissza korábbi adatot, `stale=true` jelzéssel. Elavult ár nem vesz részt a nyertes kosár számításában. A forrás nem ad minden rekordhoz üzleti módosítási időt; a lekérés idejét nem nevezzük annak.
- Az árhoz tartozó üzletlista nem készletnyilvántartás. Online kiszállítási árakat nem keverünk az üzleti árakkal. Egyéni kuponok és különleges jogosultságok nincsenek modellezve.
- Kimért termékeket a kereső jelez, de ebben a verzióban nem lehet hozzáadni: a súlymennyiség-kezelés külön fejlesztést igényel.
- Az Alpha 0.4 általános Open Food Facts / ötelemű belső katalógusát a fő keresésben a GVH-katalógus váltja fel, mert az előző találatok többségéhez nem volt ár. A korábbi `data/` fájlok megmaradtak, de az új számítás nem használja őket.
- A korábbi Auchan HTML-parser kivezetve: egy ajánlóblokk vagy félreolvasott ár nem válhat bolti ajánlattá. Az új felület a közös adaptert használja.
- A helyi mentés nem Supabase-adatbázis. A forrásban korábban sem volt működő Supabase-bekötés; fiók és többeszközös mentés nincs ebben a kiadásban.

## A meglévő Vercel-projekt frissítése

1. A meglévő projekt forrásában külön ágon alkalmazd a csomag tartalmát; őrizd meg a projekt saját környezeti beállításait.
2. Válassz támogatott Node.js 22/24 futtatókörnyezetet. Telepítés: `npm ci`; build: `npm run build`; keretrendszer: Next.js.
3. Először készíts teszttelepítést ugyanahhoz a projekthez. Ellenőrizd a kimenő GVH-elérést és a szolgáltatói futásidőkorlátot. A számítás végpont `maxDuration=120` másodpercet kér; a szolgáltatói csomagnak ezt engednie kell. Lassú forrásnál a legnagyobb kosár akár kb. 105 másodperc is lehet.
4. Ellenőrizd a keresés → üzletválasztás → mennyiségmódosítás → összehasonlítás folyamatot mobilon és asztali böngészőben. A forráscsomag ellenőrzésekor böngészős végponttól végpontig teszt nem készült. A telepített API-k működését közzététel után külön ellenőrizzük.
5. Üzemi használathoz következő lépés: megosztott gyorsítótár és terheléskorlát, forrásállapot-figyelés, majd igény szerint Supabase és valódi útvonal-számítás. A mostani folyamaton belüli védelem több szerverpéldány között nem közös.

## Ellenőrzési források

- [GVH Árfigyelő](https://arfigyelo.gvh.hu/), annak böngésző által használt `/api/chain-stores`, `/api/shops`, `/api/search`, `/api/product/{id}`, `/api/product/{id}/shop/{shopIds}` végpontjai. Sikeres sémaellenőrzés: 2026-09-11.
- [GVH gyakori kérdések](https://arfigyelo.gvh.hu/docs/arfigyelo_GYIK.pdf).
- [UNAS API dokumentáció](https://unas.hu/tudastar/api).
- [Next.js biztonsági javítási tájékoztató](https://nextjs.org/blog/security-update-2025-12-11). A projekt a korábbi 14.2.5-ről az npm-regiszterben 2026-09-11-én elérhető 15.5.25 kiadásra frissült. A React 18 és a Next.js/Vercel felépítés megmaradt. A PostCSS tranzitív függőség 8.5.23-ra rögzített felülírást kapott a [közzétett biztonsági javítás](https://github.com/postcss/postcss/security/advisories/GHSA-fxqj-rqcc-2cmp) miatt.

Az automatikus tesztek szintetikus árakkal vizsgálják a számítás üzleti szabályait; az egyértelműen megjelölt GVH JSON-minta a séma ellenőrzésére szolgál. Sem a tesztadat, sem a mellékelt ellenőrzési jegyzőkönyv nem kerül élő árként a felületre.
