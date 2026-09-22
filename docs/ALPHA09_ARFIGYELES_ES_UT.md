# KosárRadar Alpha 0.9 – árfigyelés és teljes bevásárlási költség

## Termékirány

Pontos termékekből és kiszerelésekből mentett kosár, konkrét kedvenc üzletek, üzletenkénti árváltozásjelzés, majd ajánlás a termékár és a teljes oda-vissza út alapján. A felhasználó látja a döntés számítását és az alternatívát is.

## Most használható

- Az Alpha 0.8 menthető kosarai, pontos termékválasztása, település/körzet keresése és kedvenc üzletei megmaradtak.
- Jármű: benzines, dízel, hibrid, elektromos, kerékpár, gyalog. Fogyasztás, energiaár, egyéb Ft/km költség, parkolás/megálló, legfeljebb 1–3 üzlet, minimummegtakarítás. A kezdő számok jelölt példaértékek; nem élő üzemanyagárak. A járműbeállítás a kosárral együtt menthető.
- Kézzel megadott teljes úthossz kalkulátora, szolgáltatói kulcs nélkül. Az eredményt nem rendeli önkényesen boltokhoz.
- Helyi árfigyelés: legfeljebb 3 rögzített kosár × legfeljebb 8 üzlet; megnyitáskor, újra láthatóvá váláskor, látható oldalon 15 percenként vagy gombnyomásra. Az árforrás 15 perces gyorsítótára miatt a kézi ellenőrzés sem feltétlenül jelent új upstream lekérést.
- Jelzés minden változásra / csökkenésre / emelkedésre, minimum Ft/csomag küszöbbel. Régi ár, új ár, üzlet, pontos termék, észlelési idő, olvasottság. A csomagár a visszaváltási díjat is tartalmazza.
- Az első sikeres megfigyelés csak kiinduló ár. Hiányzó, hibás, elavult, azonos vagy régebbi megfigyelésből nincs jelzés. A hűségár csak a figyelésben mentett jogosultsággal használható.
- A figyelés rögzített példány: a kosár, a kedvencek vagy a hűségkártyák későbbi módosítása nem módosítja automatikusan. Ezt a felület jelzi; törlés és új figyelés készíthető.
- A helyi állapot az adott böngészőhöz tartozik. Bezárt app mellett nem fut. Push/e-mail nincs ebben a verzióban.

## Közúti útvonal – integráció elkészült, aktiválásra vár

Az `ORS_API_KEY` szerveroldali kulccsal a `/api/routes` az openrouteservice Matrix API profilfüggő távolságait és menetidejét kéri le. Nyolc kijelölt üzletig minden megengedett 1–3 boltos kombináció és megállósorrend számításba kerül. Irányonként eltérő távolságot és hazautat is számolunk. Elérhetetlen útszakasz nem lesz 0 km. Nem használunk légvonalból képzett, közútinak beállított becslést.

Költség = termékár × mennyiség + visszaváltási díj + km × fogyasztás / 100 × energiaár + km × egyéb Ft/km + megállószám × parkolás.

A minimummegtakarítási küszöb akkor ajánlhat egyboltos megoldást a matematikailag legolcsóbb többboltos helyett, ha van teljes egyboltos kosár, és a többboltos megtakarítás a küszöb alatt van. Az olcsóbb alternatíva ekkor is látható. A régi, becsült másodikmegálló-költség helyett ez a külön útköltségszámítás használatos; a kosárár-nézetben nincs utazási költség.

Alapkiindulópont a település központja. Külön gombbal böngészős helymeghatározás használható; a pontos hely nem mentődik. A koordinátát tervezéskor az openrouteservice, a navigációs link megnyitásakor a Google kapja meg; a kosár nem kerül a térképszolgáltatóhoz. A bolti körzet továbbra is a településközponthoz képest értendő.

A menetidő külön jelenik meg. Bevásárlási idő, forgalmi késés, útdíj és idő pénzbeli értéke nem része a költségnek. A Google Maps újraszámíthatja az útvonalat. Az ajánlás csak a kijelölt boltokra és friss, teljes árlefedettségre érvényes; nem készletígéret. Tömegközlekedés, teherautó és egyedi kupon nincs modellezve.

Források: [ORS Matrix](https://giscience.github.io/openrouteservice/api-reference/endpoints/matrix/), [Google Maps URL-ek](https://developers.google.com/maps/documentation/urls/get-started).

## Háttérfigyelés – elkészült kód, még nem aktív

A `supabase/price-watches.sql` tulajdonosi RLS-sel védett figyeléseket és értesítéseket hoz létre. Felhasználó csak a saját figyelését olvashatja, hozhatja létre és törölheti; megfigyelt árat és értesítést nem írhat. Az értesítésből csak az olvasottság módosítható. Felhasználónként 10 figyelés a limit, párhuzamos mentésnél is.

A `/api/cron/prices` kizárólag szerveroldali `CRON_SECRET` hitelesítéssel fut; csak a worker kap service-role hozzáférést. Egy futás legfeljebb 30 esedékes figyelést olvas be, 240 másodperces munkakerettel, a legrégebben ellenőrzött figyeléssel kezdve. A fel nem dolgozott figyelések esedékesek maradnak. Korlátozott kapacitású alfa: a napi ütemezés nem garantál napi lefedettséget minden felhasználónál; nagyobb terheléshez tartós munkasor és gyakoribb worker kell.

Az árfrissítés és az értesítés létrehozása egy adatbázis-tranzakció. Sorzár, elvárt korábbi ellenőrzési idő és egyedi eseményazonosító véd az ismételt vagy párhuzamos futástól. Törölt figyelést a folyamat nem hoz vissza. A részleges/hibás ellenőrzés állapota látszik; 36 órás késésnél a felület figyelmeztet. Figyelésenként legfeljebb 100 közelmúltbeli jelzés marad meg.

A `vercel.json` napi `0 5 * * *` UTC ellenőrzést készít elő. Vercel Cron csak production telepítésben fut; a draft branch preview-ja nem aktiválja. A jelzések a fiók alkalmazáson belüli listájába kerülnek, push/e-mail nincs. Árváltozás után az aktuális kosár ár- és útiköltség-ajánlása újra lekérhető; háttérben újraszámolt, eltárolt ajánlásváltozás-értesítés még nincs.

Forrás: [Vercel Cron kezelése](https://vercel.com/docs/cron-jobs/manage-cron-jobs), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Aktiválási állapot (2026-09-22)

- A meglévő `cnawwcrzkqlrpclfjsjr` Supabase projekt a connector szerint `INACTIVE`; SQL lekérés időtúllépésbe futott. Az új árfigyelési SQL **nincs alkalmazva**, az új RLS/RPC élő adatbázispróbája hátravan. Nem készült új projekt.
- A Vercel teamhez a connector 403 hozzáférési hibát ad. Környezeti változókat és projektbeállításokat nem módosítottunk, védelmet nem kapcsoltunk ki. A forrás az eredeti draft ágra kerül; a meglévő GitHub–Vercel integráció építi a preview-t.
- Nincs konfigurált útvonal-szolgáltatói kulcs és nem igazolt aktív háttérworker. A felület ezeket nem nevezi működő éles szolgáltatásnak.
- Aktiválási sorrend: meglévő Supabase projekt visszaállítása; SQL alkalmazása és két felhasználóval RLS/RPC próba; fiókbeállítás; szerveroldali `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `ORS_API_KEY`; worker próba; csak ezután `PRICE_WATCH_ENABLED=true` és production Cron aktiválás. Kulcsot soha nem kell chatbe vagy a forráskódba írni.

## Ellenőrzés

39/39 automatizált teszt, TypeScript és production build. Új regressziók: közelebbi üzlet előnye az útiköltség miatt; drága második megálló; aszimmetrikus út és hazaút; három üzlet; elérhetetlen szakasz; pontos termék; hűségár; mennyiség és betétdíj; első ármegfigyelés; duplázás és régebbi megfigyelés; küszöb; mentett beállítások; same-origin ellenőrzés a Next bind címe mögött.

A buildelt alkalmazás HTTP-próbája sikeres: főoldal 200, funkcióállapotok konfigurálatlanok, hitelesítés nélküli háttérworker és fiókfigyelés 401, eltérő eredetű útvonalkérés 403. Élő GVH-próba: 223 üzlet; a Cappy 100% almalé 1 l egyik miskolci Auchanban 999 Ft-os normál árral, a vizsgált Tescónál hiányjelzéssel érkezett. Ez ellenőrzési pillanatkép, nem árígéret.

A helyi böngészős ellenőrzést a környezet `ERR_BLOCKED_BY_CLIENT` hibával blokkolta. A mobilos/interaktív végponttól végpontig próba, az ORS valódi kulccsal végzett ellenőrzése és az éles háttérfigyelés próbája hátravan. Az aktiválásig a PR draft marad.
