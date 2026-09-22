# Alpha 0.8 – menthető kosár, település és körzet

## Használat

1. Nevezd el a kosarat, majd írj fel szabad szöveges tételeket.
2. Az aktív sor lenyíló listájából válassz pontos terméket és kiszerelést. A részletes termékkártyák és a kategóriakereső továbbra is elérhetők. Más sor aktiválásával annak javaslatai jelennek meg.
3. A Kosár mentése új példányt készít. A Mentett kosarak alatt megnyitható. A még pontosítatlan sorok is megmaradnak. Vendégként a mentés az adott böngészőben marad; működő bejelentkezéssel a saját fiókhoz kerül.
4. Válassz települést a keresési találatokból, és állíts be 1–100 km-es körzetet. A számítás a település középpontjától mért légvonalat használja, nem közúti útvonalat. A település határain kívüli közeli boltok is szerepelnek.
5. Minden környékbeli Auchan/Tesco találat kijelölődik. Boltok kihagyhatók, csillagozhatók és kedvencre/láncra szűrhetők. A 8 üzletes upstream lekérések sorban futnak, így a 8. utáni üzletek sem maradnak ki.
6. Üzletenként látszik a kosárösszeg, lefedettség, visszaváltási díj kezelése. Csak teljes, friss árral lefedett kosár nyerhet az összehasonlításban. A hiányzó ár nem nulla és nem készlethiány-igazolás.

## AI és fiók aktiválása

- Az AI átnézi a listát gomb a szerveroldali `OPENAI_API_KEY` és `OPENAI_MODEL` konfigurációval működik. Structured Outputs-kompatibilis Responses API-modell szükséges. Kulcsot ne tegyél forráskódba vagy NEXT_PUBLIC változóba.
- Az AI csak keresési értelmezést javasol. Az eredeti beírás megmarad, az értelmezés visszavonható; konkrét termékazonosítót és árat kizárólag a GVH-adatforrás ad. Felhasználói kiválasztás nélkül nincs árképzés. A modell válaszának sorai és mennyiségei validáltak, egy szerverpéldányon korlátozott párhuzamossággal és hívásszámmal.
- Konfiguráció nélkül a gomb kikapcsolt, és a felület egyértelműen katalóguskeresést jelez. Az AI-hívás hibája nem módosítja a listát. Éles AI-hívás nem volt ellenőrizhető a jelenlegi konfigurációban.
- A `supabase/saved-baskets.sql` táblája és szabályai alkalmazva lettek a meglévő KosarRadar Supabase projektben. Az alkalmazás a korábbi, getUser-alapú hitelesítést használja; nincs service-role kulcs.
- A telepítésen továbbra is szükséges a SUPABASE_URL és SUPABASE_PUBLISHABLE_KEY, valamint az engedélyezett átirányítási címek és a kívánt belépési szolgáltatók beállítása. Lásd FIOK_BEALLITAS.md. A teljes, többeszközös bejelentkezés/mentés még nem igazolt.

## Ellenőrzés – 2026-09-12

- 25/25 automatikus teszt sikeres; TypeScript és production build sikeres.
- A buildelt alkalmazás HTTP-próbája: főoldal, városkeresés, üzletlista, termékjavaslat, üzletenkénti összehasonlítás, AI és auth konfigurációs állapot.
- Élő forrás: 223 Auchan/Tesco üzlet, mindegyikhez feldolgozható koordináta.
- Nyékládháza, 20 km: 7 üzlet; két Auchan Miskolcon, négy Tesco Miskolcon és egy Tesco Tiszaújvárosban.
- „Cappy almalet” → 5993330001081, Cappy 100% almalé, 1 l. A két Auchanban 999 Ft normál / 749 Ft hűségár; az öt Tescohoz erre az azonosítóra nem érkezett ár. Ezek pillanatnyi teszteredmények, nem beégetett termék- vagy áradatok.
- Supabase RLS tranzakciós próba két ideiglenes identitással: saját írás/olvasás engedélyezett, másik felhasználó adata nem olvasható és számára nem írható, anon olvasás/írás tiltott. A tesztadatok visszagörgetve. Security Advisor: nincs találat.
- A jelen környezetben a helyi böngészős próba nem volt elérhető; a kattintási és mobilos megjelenési folyamat vizuálisan nincs igazolva.

## Források

- https://arfigyelo.gvh.hu
- https://open-meteo.com/en/docs/geocoding-api
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://supabase.com/docs/guides/database/postgres/row-level-security
