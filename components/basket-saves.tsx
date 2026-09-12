'use client';
import {useEffect,useRef,useState} from 'react';
import {useAccount} from './account-provider';
import {BASKETS_KEY,savedBasketsInput,snapshotInput,type BasketSnapshot,type SavedBasket} from '../lib/saved-baskets';
export function BasketSaves({snapshot,onLoad}:{snapshot:BasketSnapshot;onLoad:(s:BasketSnapshot)=>void}){
 const {user,busy:accountBusy,error:accountError}=useAccount();
 const [saved,setSaved]=useState<SavedBasket[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[open,setOpen]=useState(false);
 const epoch=useRef(0);
 useEffect(()=>{const token=++epoch.current;setSaved([]);setError('');setMessage('');if(accountBusy)return;setBusy(true);
  (async()=>{try{let rows:unknown;if(user){const r=await fetch('/api/baskets',{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error);rows=d.baskets;}else rows=JSON.parse(localStorage.getItem(BASKETS_KEY)||'[]');
   const parsed=savedBasketsInput(rows);if(token===epoch.current)setSaved(parsed);
  }catch(e){if(token===epoch.current)setError(e instanceof Error?e.message:'Nem sikerült betölteni a kosarakat.');}finally{if(token===epoch.current)setBusy(false);}})();return()=>{epoch.current++;};
 },[user?.id,accountBusy]);
 async function save(){if(busy||accountBusy)return;const clean=snapshotInput(snapshot);if(!clean){setError('Adj nevet a kosárnak, és írj fel legalább egy tételt.');return;}
  const token=epoch.current;setBusy(true);setError('');setMessage('');try{let entry:SavedBasket;
   if(user){const r=await fetch('/api/baskets',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(clean)});const d=await r.json();if(!r.ok)throw Error(d.error);entry=savedBasketsInput([d.basket])[0];}
   else {const latest=savedBasketsInput(JSON.parse(localStorage.getItem(BASKETS_KEY)||'[]'));if(latest.length>=50)throw Error('Ezen az eszközön legfeljebb 50 kosár menthető.');entry={id:crypto.randomUUID(),createdAt:new Date().toISOString(),snapshot:clean};localStorage.setItem(BASKETS_KEY,JSON.stringify([entry,...latest]));}
   if(token===epoch.current){setSaved(prev=>[entry,...prev].slice(0,50));setMessage(user?'A kosár a fiókodba mentve.':'A kosár ezen az eszközön elmentve.');}
  }catch(e){if(token===epoch.current)setError(e instanceof Error?e.message:'A mentés sikertelen.');}finally{if(token===epoch.current)setBusy(false);}
 }
 return <div className="basket-saves"><div className="save-actions"><button className="primary" onClick={save} disabled={busy||accountBusy||!!accountError||!snapshot.lines.length}>{busy?'Betöltés / mentés…':'Kosár mentése'}</button><button aria-expanded={open} onClick={()=>setOpen(v=>!v)}>Mentett kosarak ({saved.length})</button></div>
 <p className="hint">{user?'Mentés a fiókodba, másik eszközről is megnyitható.':'Vendégként csak ebben a böngészőben mentünk. A fiókhoz jelentkezz be.'} A mentés új példányt készít; megnyitáskor friss árakat kérünk.</p>
 {error&&<p className="error" role="alert">{error}</p>}{message&&<p className="success" role="status">{message}</p>}
 {open&&<div className="saved-list">{!saved.length&&<p className="hint">Még nincs mentett kosár.</p>}{saved.map(s=><article key={s.id}><div><strong>{s.snapshot.name}</strong><span>{s.snapshot.lines.length} tétel · {s.snapshot.area.place?.name||'Helyszín nélkül'} · {new Date(s.createdAt).toLocaleString('hu-HU',{timeZone:'Europe/Budapest'})}</span></div><button onClick={()=>{if(snapshot.lines.length&&!window.confirm('Megnyitod a mentett kosarat? A jelenlegi, külön el nem mentett módosítások helyére ez kerül.'))return;onLoad(s.snapshot);setMessage('Kosár megnyitva. Az árak újból ellenőrzésre kerülnek.');}}>Megnyitás</button></article>)}</div>}
 </div>;
}
