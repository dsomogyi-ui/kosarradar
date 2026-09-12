# Alpha 0.6 – fiókok aktiválása

A forrás elkészült; a felhős belépéshez egy konkrét Supabase projekt és a szolgáltatók beállításai szükségesek. Az alkalmazás nem szimulál sikeres bejelentkezést. Hiányzó beállításnál vendégmódban működik.

1. A kijelölt Supabase projekt SQL szerkesztőjében futtasd egyszer a `supabase/schema.sql` fájlt. A `user_preferences` táblán RLS szabály védi az egyes felhasználók adatait. A felhasználóazonosítót mindig a szerver hitelesített `getUser()` válaszából vesszük.
2. Vercelben állítsd be a `SUPABASE_URL` és `SUPABASE_PUBLISHABLE_KEY` változókat az érintett Preview / Production környezetben. A publishable kulcs publikus használatra való. Service role kulcsra nincs szükség. Telepíts újra.
3. Supabase Auth / URL Configuration: Site URL az alkalmazás végleges HTTPS címe. A Redirect URLs listába csak a használt alkalmazáscímeket add: `/auth/callback`, `/auth/callback?recovery=1`. A teszttelepítés pontos címe is szükséges.
4. Auth / Providers: engedélyezd az e-mailes regisztrációt és az e-mail-megerősítést. Állíts be legalább 10 karakteres jelszószabályt. Külső felhasználók megerősítő és visszaállító leveleihez konfigurálj saját SMTP szolgáltatást, és ellenőrizd a kézbesítést.
5. A Google Cloud Console OAuth webalkalmazásában add meg a Supabase által mutatott callback címet (`https://PROJECT.supabase.co/auth/v1/callback`), majd a Client ID és Client secret értékét a Supabase Google provider beállításába.
6. A Meta fejlesztői felületen hozz létre Facebook Login alkalmazást, állítsd be a Supabase callback címet, a szükséges alkalmazásadatokat és az éles használat feltételeit. Az App ID és App secret a Supabase Facebook provider beállításába kerül. Ezeket ne tedd a frontendbe vagy a repóba.
7. E-mail-sablonokban használható a külön tokenes visszahívás: regisztrációhoz `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup`, visszaállításhoz ugyanez `type=recovery` paraméterrel. A standard PKCE `ConfirmationURL` is támogatott, a regisztrációt indító böngészőben.

## Átadás előtti élő ellenőrzés

- Két külön tesztfiókkal igazolni: saját kedvencek olvasása / mentése működik, másik user_id olvasása üres, írása tiltott a közvetlen Data API-n is.
- Regisztráció → ténylegesen kézbesített megerősítő levél → belépés → kedvenc mentése → második eszköz → kijelentkezés.
- Google és Facebook beleegyezési és visszatérési folyamat valódi tesztfiókkal.
- Jelszó-visszaállítás, lejárt link, hibás jelszó, munkamenetfrissítés, fiókváltás.
- Supabase Security Advisors futtatása a célprojekten.

A felsorolt élő auth ellenőrzések projekt-hozzáférés és szolgáltatói konfiguráció hiányában még nem történtek meg. A programtesztek nem helyettesítik ezeket.

Dokumentáció: https://supabase.com/docs/guides/auth/server-side/creating-a-client ; https://supabase.com/docs/guides/auth/social-login/auth-google ; https://supabase.com/docs/guides/auth/social-login/auth-facebook ; https://supabase.com/docs/guides/auth/auth-smtp
