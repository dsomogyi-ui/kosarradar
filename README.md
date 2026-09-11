# KosárRadar Alpha 0.6

Kategóriákból összeállítható bevásárlólista, konkrét üzletek árai és egy-/kétüzletes kosár-összehasonlítás.

## Újdonságok

- Kizárólag Auchan és Tesco: üzletlista, név/vonalkód keresés és kategóriás terméklista is szűrt; más lánc üzletét a szerver visszautasítja.
- Élő GVH kategóriafa: főcsoport → alcsoport → termékkategória. Megmaradt a név- és vonalkódkeresés.
- Konkrét üzletek csillagozása, kedvencszűrő, kedvencek gyors kijelölése (legfeljebb 8 összehasonlított üzlet).
- Fiókoldal: e-mailes regisztráció, belépés, megerősítés, jelszó-visszaállítás, névmódosítás, kijelentkezés. Google és Facebook OAuth integráció.
- Kedvencek vendégként ezen az eszközön; bejelentkezve a felhasználó saját Supabase rekordjában. A kosár és összehasonlítási beállítások továbbra is eszközönként mentődnek.

## Aktiválási állapot

A katalógus és vendégkedvencek konfiguráció nélkül használhatók. A felhős fiókok a kijelölt Supabase projekt URL-jének, publishable kulcsának és adatbázissémájának beállítása után működnek. A Google/Facebook gomb csak az adott szolgáltató tényleges bekapcsolásakor aktív. A teljes élő bejelentkezési folyamat még nincs hitelesítve. Részletek: [Fiókbeállítás](docs/FIOK_BEALLITAS.md).

## Futtatás

Node >=22.18.0, `npm ci`, `npm run dev`. Környezeti minta: `.env.example`.
Ellenőrzés: `npm test`, `npm run typecheck`, `npm run build`.

## Árak és korlátok

Árforrás: GVH Árfigyelő. Pontos termékazonosító és kiszerelés; hűségár csak a megjelölt láncnál; visszaváltási díj külön. Legfeljebb 24 tétel és 8 üzlet; az optimalizálás egy vagy két üzletet vizsgál. A kimért termékek még nem számolhatók. Hiányos vagy elavult ár nem ad teljes kosaras ajánlatot. Az ár megléte nem készletigazolás. Egyéni kuponok nincsenek levonva.

A lapozás a GVH 20 soros forrásoldalait követi, a két láncra szűrés után kevesebb találat maradhat egy oldalon. Az alkalmazás nem tünteti fel az összes lánc összesített találatszámát sajátjaként.
