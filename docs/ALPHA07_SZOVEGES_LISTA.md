# Alpha 0.7 – szabad szöveges bevásárlólista

Bal oldalon a bevásárlási igények, jobb oldalon a kijelölt tételhez kapcsolódó konkrét termékek jelennek meg. Mobilon a két oszlop egymás alá rendeződik.

## Cappy próba

1. Kattints a „Cappy-példa kipróbálása” gombra, vagy írd be: `Cappy almalé, 2 liter`.
2. Válaszd a `Cappy 100% almalé 1 l` terméket. A program 2 dobozzal számol.
3. Válassz konkrét Auchan/Tesco üzleteket, és jelöld a hűségkártyát, ha van.
4. Az összehasonlítás automatikusan elindul. Termék-, üzlet- és hűségkártya-módosítás után újraszámolódik.

## Szabályok

- A feldolgozás determinisztikus: nem LLM, és nem következtet szabadon tetszőleges mondatokra.
- Sorok, pontosvesszők és vesszők választják el a tételeket; a tizedesvessző és a termékhez tartozó mennyiség együtt marad.
- Támogatott mennyiségek: liter/l/ml, kg/g, db/darab/csomag. Mennyiség nélkül 1 csomag az igény; ez látható a felületen.
- Eltérő méretű csomagnál felfelé kerekítünk egész csomagra, és a tényleges megvásárolt mennyiséget már választás előtt feltüntetjük. Nem értelmezhető kiszerelés esetén darabszámot kell megadni.
- A márka és a termékszavak szűrik a találatokat; az almalé/alma elnevezést egységesítjük. Automatikus márkahelyettesítés nincs. A kategóriaböngészőbe külön átváltva más termék is kifejezetten kiválasztható.
- A GVH keresés a több szóból álló igényre gyakran üres választ ad. A javaslatok az első keresőszó 100-as forrásoldalaiból, a teljes igény szavaival és az Auchan/Tesco-láncszűréssel készülnek. További találatok lapozhatók. Ez nem teljes szabadnyelvi kereső.
- Az ár csak konkrét termék kiválasztása és konkrét üzlet kijelölése után számolódik. Kiválasztásra váró soroknál kizárólag egyértelműen jelölt részösszeg jelenik meg.
- A korábban választott változat a friss találatok között előre kerül, de újra ki kell választani. Korábbi árat nem használunk ajánlatként.
- A szöveges lista és a választási emlékezet az adott böngészőben tárolódik, nem a felhős fiókban. A régi bevásárlólista megmarad és első használatkor betöltődik.
- A fiókkezelés aktiválási állapotát ez a változtatás nem módosítja.

Ellenőrzés: a szövegfeldolgozás és a mennyiségi konverzió automatizált tesztjei a meglévő árlogikai tesztekkel együtt futnak. A Cappy-folyamat élő GVH-adatokkal is ellenőrizhető. Böngészős interakciós teszt nem készült ebben a körben.
