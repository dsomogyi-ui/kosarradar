'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {useAccount} from '../../components/account-provider';
import type {Shop} from '../../lib/types';
export default function Account(){
 const {client,config,user,favorites,busy,error,refresh,save}=useAccount();
 const [mode,setMode]=useState<'login'|'signup'|'reset'|'password'>('login'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[message,setMessage]=useState(''),[failure,setFailure]=useState(''),[working,setWorking]=useState(false),[shops,setShops]=useState<Shop[]>([]);
 useEffect(()=>{const q=new URLSearchParams(location.search);if(q.has('authError'))setFailure('A belépési hivatkozás lejárt vagy nem érvényes. Próbáld újra.');if(q.get('recovery')==='1')setMode('password');},[]);
 useEffect(()=>{setName(user?.displayName||'');},[user?.id,user?.displayName]);
 useEffect(()=>{const c=new AbortController();fetch('/api/shops',{signal:c.signal}).then(r=>r.json()).then(d=>setShops(d.shops||[])).catch(()=>{});return()=>c.abort();},[]);
 function switchMode(next:typeof mode){setMode(next);setPassword('');setMessage('');setFailure('');}
 async function action(run:()=>Promise<void>){setWorking(true);setFailure('');setMessage('');try{await run();}catch(e){setFailure(e instanceof Error?e.message:'A művelet nem sikerült.');}finally{setWorking(false);setPassword('');}}
 function check(e:{message:string;code?:string}|null){if(e)throw Error(e.code==='invalid_credentials'?'Hibás e-mail-cím vagy jelszó.':e.code==='email_not_confirmed'?'Előbb erősítsd meg az e-mail-címed a kapott levélben.':e.code==='over_email_send_rate_limit'?'Túl sok levélkérés történt. Próbáld később.':e.code==='weak_password'?'Válassz erősebb jelszót.':'A művelet nem sikerült. Ellenőrizd az adatokat, majd próbáld újra.');}
 async function submit(event:FormEvent){event.preventDefault();if(!client)return;await action(async()=>{
  if(mode==='signup'){const {data,error}=await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+'/auth/callback'}});check(error);setMessage(data.session?'Sikeres regisztráció.':'Ha ezzel a címmel regisztrálhatsz, megerősítő levelet küldtünk. Ellenőrizd a beérkező és a spam mappát is.');}
  else if(mode==='reset'){check((await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+'/auth/callback?recovery=1'})).error);setMessage('Ha tartozik fiók ehhez a címhez, elküldtük a jelszó-visszaállító levelet.');}
  else if(mode==='password'){check((await client.auth.updateUser({password})).error);setMessage('Az új jelszót elmentettük.');setMode('login');history.replaceState(null,'','/account');}
  else{check((await client.auth.signInWithPassword({email,password})).error);setMessage('Sikeres belépés.');}
 });}
 async function oauth(provider:'google'|'facebook'){if(!client)return;await action(async()=>{check((await client.auth.signInWithOAuth({provider,options:{redirectTo:location.origin+'/auth/callback'}})).error);});}
 const disabled=working||busy||!config?.configured;
 return <main className="account-page"><header><a className="brand" href="/"><span className="logo">KR</span><b>KosárRadar</b></a><a href="/">← Bevásárlólistám</a></header>
  <div className="intro"><div><p className="eyebrow">SAJÁT ÜZLETEK, SAJÁT FIÓK</p><h1>{user?'Örülünk, hogy itt vagy.':'Vásárolj a saját ritmusodban.'}</h1></div></div>
  <section className="card account-card">
   {!config&&<p role="status">Bejelentkezés betöltése…</p>}
   {config&&!config.configured&&<p className="warning">{config.error||'A fiókok aktiválása még folyamatban van. Addig vendégként használhatod a bevásárlólistát és mentheted a kedvenc üzleteidet ezen az eszközön.'}</p>}
   {error&&<p className="error" role="alert">{error} <button onClick={()=>void refresh()}>Újrapróbálom</button></p>}
   {failure&&<p className="error" role="alert">{failure}</p>}{message&&<p className="success" role="status">{message}</p>}
   {user&&mode!=='password'?<><h2>Fiókom</h2><p className="muted">{user.email}</p><form onSubmit={e=>{e.preventDefault();void action(async()=>{if(await save(favorites,name))setMessage('A nevedet elmentettük.');});}} className="account-form"><label htmlFor="display-name">Megjelenített név</label><input id="display-name" maxLength={80} value={name} onChange={e=>setName(e.target.value)} autoComplete="nickname"/><button className="primary" disabled={disabled}>Név mentése</button></form>
    <h3>Kedvenc üzleteim <span className="badge">{favorites.length}</span></h3><p className="hint">A fiókodhoz mentve, másik eszközről is elérhetők.</p>
    <div className="account-favorites">{favorites.map(id=>{const s=shops.find(v=>v.id===id);return <div className="favorite-row" key={id}><span><strong>{s?.name||'Mentett üzlet'}</strong><small>{s?`${s.postalCode} ${s.city}, ${s.address}`:id}</small></span><button disabled={disabled} aria-label={`${s?.name||id} eltávolítása a kedvencekből`} onClick={()=>void save(favorites.filter(v=>v!==id))}>Eltávolítás</button></div>;})}</div>
    {!favorites.length&&<p className="empty">Még nincs kedvenc üzleted. Az üzletkeresőben a csillaggal mentheted őket.</p>}
    <a className="button-link" href="/#stores">Üzletek kiválasztása →</a><div className="account-actions"><button disabled={disabled} onClick={()=>switchMode('password')}>Jelszó módosítása</button><button disabled={disabled} onClick={()=>void action(async()=>{if(client){check((await client.auth.signOut({scope:'local'})).error);await refresh();setMessage('Kijelentkeztél ezen az eszközön.');}})}>Kijelentkezés</button></div>
   </>:<><h2>{mode==='signup'?'Új fiók létrehozása':mode==='reset'?'Elfelejtett jelszó':mode==='password'?'Új jelszó megadása':'Belépés a fiókodba'}</h2>
    {(mode==='login'||mode==='signup')&&<><div className="social-buttons"><button disabled={disabled||!config?.google} onClick={()=>void oauth('google')}>Folytatás Google-fiókkal</button><button disabled={disabled||!config?.facebook} onClick={()=>void oauth('facebook')}>Folytatás Facebook-fiókkal</button></div>{config?.configured&&(!config.google||!config.facebook)&&<p className="hint">A szürke belépési lehetőség még nincs aktiválva.</p>}<div className="divider">vagy e-mail-címmel</div></>}
    {mode==='password'&&!busy&&!user&&<p className="warning">A jelszó módosításához jelentkezz be, vagy nyisd meg a levélben kapott érvényes visszaállító hivatkozást.</p>}
    <form className="account-form" onSubmit={submit}>{mode!=='password'&&<><label htmlFor="email">E-mail-cím</label><input id="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></>}
     {mode!=='reset'&&<><label htmlFor="password">{mode==='password'?'Új jelszó':'Jelszó'}</label><input id="password" type="password" autoComplete={mode==='login'?'current-password':'new-password'} required minLength={mode==='login'?1:10} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/>{mode!=='login'&&<small>Legalább 10 karakter. Használj egyedi jelszót.</small>}</>}
     <button className="primary" disabled={disabled||(!config?.email&&mode!=='password')||(mode==='password'&&!user)||(mode==='signup'&&!config?.signup)}>{working?'Folyamatban…':mode==='signup'?'Regisztráció':mode==='reset'?'Visszaállító levél küldése':mode==='password'?'Új jelszó mentése':'Belépés'}</button>
    </form><div className="account-actions">{mode==='login'?<><button disabled={working} onClick={()=>switchMode('signup')}>Még nincs fiókom</button><button disabled={working} onClick={()=>switchMode('reset')}>Elfelejtett jelszó</button></>:<button disabled={working} onClick={()=>switchMode('login')}>Vissza a belépéshez</button>}</div>
   </>}
   <p className="hint"><a href="/">Folytatás a bevásárlólistához →</a></p>
  </section><footer>KosárRadar · Alpha 0.6 · Auchan, Tesco, Lidl, Aldi</footer>
 </main>;
}
