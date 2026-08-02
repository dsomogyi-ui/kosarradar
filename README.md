# KosárRadar Live Alpha 0.2 – Perwoll

Ez a verzió szerveroldalon megpróbálja lekérni a Perwoll aktuális online árát az Auchan, dm és Rossmann termékoldalairól.

## Frissítés GitHubon böngészőből

A legegyszerűbb, ha a repository jelenlegi fájljait lecseréled a ZIP tartalmára:

1. Csomagold ki a ZIP-et.
2. GitHubon töltsd fel az új fájlokat azonos elérési úttal.
3. Az `app/page.tsx` és `app/globals.css` fájlok felülíródnak.
4. Új fájl: `app/api/perwoll/route.ts`.
5. Commit után a Vercel automatikusan új deploymentet indít.

## Működés

- `/api/perwoll` lekéri a három forrásoldalt.
- Több tipikus HTML/JSON-LD árformátumot felismer.
- Az eredményt 30 percig gyorsítótárazza.
- Minden találat mellett megmarad a közvetlen termékoldal linkje.

## Korlátok

- A boltok módosíthatják az oldalaik szerkezetét, ekkor az árkinyerést frissíteni kell.
- Egyes oldalak automatizált kéréseket korlátozhatnak.
- Az online ár eltérhet a konkrét áruház polcárától és hűségkártyás árától.
- A dm termék jelenleg 4 l / 80 mosás, ezért nem azonos kiszerelés a 3,75 l / 75 mosásos ajánlatokkal.
