'use client';
import {useEffect,useRef,useState} from 'react';
import {useAccount} from './account-provider';
import {WATCH_KEY,localWatches,observe,watchInput,type LocalWatch,type WatchConfig,type WatchNotice} from '../lib/price-watch';
import type {BasketItem,Comparison,Shop} from '../lib/types';
const ft=(n:number)=>new Intl.NumberFormat('hu-HU',{style:'currency',currency:'HUF',maximumFractionDigits:2}).format(n);
const stamp=(s:string)=>new Date(s).toLocaleString('hu-HU',{timeZone:'Europe/Budapest'});
type WatchView={id:string;config:WatchConfig;checkedAt:string|null;status?:string};
export function PriceWatches({name,basket,shops,selectedIds,loyalty,unresolved,onRefresh}:{name:string;basket:BasketItem[];shops:Shop[];selectedIds:string[];loyalty:string[];unresolved:number;onRefresh:()=>void}){
 const {user,favorites}=useAccount();
 const [configured,setConfigured]=useState(false),[mode,setMode]=useState<'local'|'cloud'>('local'),[scope,setScope]=useState<'favorites'|'selected'>('favorites');
 const [direction,setDirection]=useState<WatchConfig['direction']>('all'),[threshold,setThreshold]=useState(0),[watches,setWatches]=useState<WatchView[]>([]),[notices,setNotices]=useState<WatchNotice[]>([]),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[checking,setChecking]=useState(false);
 const generation=useRef(0),checkingRef=useRef(false),requestRef=useRef<AbortController|null>(null);
 const shopIds=(scope==='favorites'?favorites:selectedIds).filter(id=>shops.some(s=>s.id===id));
 const shopLabel=(id:string)=>{const s=shops.find(s=>s.id===id);return s?`${s.name} · ${s.city}, ${s.address}`:id;};
 function showLocal(data:ReturnType<typeof localWatches>){setWatches(data.watches);setNotices(data.notices);}
 async function reloadCloud(token:number){const r=await fetch('/api/watches',{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error||'Nem tölthető be.');if(token!==generation.current)return;setWatches(d.watches.map((w:{id:string;config:WatchConfig;last_checked_at:string|null;last_status:string})=>({id:w.id,config:w.config,checkedAt:w.last_checked_at,status:w.last_status})));setNotices(d.notices);}
 async function checkLocal(){
  if(checkingRef.current||mode!=='local'||!shops.length||document.visibilityState!=='visible')return;
  checkingRef.current=true;setChecking(true);const token=generation.current,controller=new AbortController();requestRef.current=controller;setError('');
  try{
   const data=localWatches(localStorage.getItem(WATCH_KEY));let failed=0;
   for(const watch of data.watches){
    if(controller.signal.aborted||token!==generation.current)return;
    const r=await fetch('/api/compare',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({items:watch.config.items.map(({code,qty})=>({code,qty})),shopIds:watch.config.shopIds,loyaltyChainIds:watch.config.loyalty,extraStopCost:0})});
    const result:Comparison & {error?:{message:string}}=await r.json();if(!r.ok)throw Error(result.error?.message||'Az árak nem ellenőrizhetők.');
    if(controller.signal.aborted||token!==generation.current)return;
    // Re-read after the request: another tab may have checked or deleted this watch.
    const latest=localWatches(localStorage.getItem(WATCH_KEY)),current=latest.watches.find(w=>w.id===watch.id);if(!current)continue;
    const observed=observe(watch.id,current.config,current.prices,result.quotes,shops);
    if(result.quotes.some(q=>q.status!=='ok'||q.stale))failed++;
    current.prices=observed.prices;current.checkedAt=new Date().toISOString();
    const fresh=observed.events.map(e=>({...e,watchId:watch.id,watchName:current.config.name,productName:current.config.items.find(i=>i.code===e.code)?.name||e.code,read:false}));
    latest.notices=[...fresh,...latest.notices].filter((n,i,all)=>all.findIndex(x=>x.id===n.id)===i).sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt)).slice(0,100);
    localStorage.setItem(WATCH_KEY,JSON.stringify(latest));showLocal(latest);
   }
   if(failed)setError('Néhány terméknél nincs friss áradat. Ezeknél megtartottuk az utolsó ismert árat; nem küldtünk változásjelzést.');
  }catch(e){if(!controller.signal.aborted&&token===generation.current)setError(e instanceof Error?e.message:'Az árfigyelés ellenőrzése nem sikerült.');}
  finally{checkingRef.current=false;if(token===generation.current)setChecking(false);}
 }
 useEffect(()=>{fetch('/api/watches/status',{cache:'no-store'}).then(r=>r.json()).then(d=>setConfigured(d.configured===true)).catch(()=>setConfigured(false));},[]);
 useEffect(()=>{if(!user)setMode('local');},[user?.id]);
 useEffect(()=>{
  const token=++generation.current;requestRef.current?.abort();setWatches([]);setNotices([]);setError('');setMessage('');setChecking(false);
  if(mode==='cloud'&&!user)return;
  async function load(){try{if(mode==='cloud')await reloadCloud(token);else showLocal(localWatches(localStorage.getItem(WATCH_KEY)));}catch(e){if(token===generation.current)setError(e instanceof Error?e.message:'Nem sikerült betölteni.');}}
  void load();const sync=()=>{if(document.visibilityState==='visible')void load();};window.addEventListener('storage',sync);
  const timer=mode==='cloud'?setInterval(sync,60000):undefined;
  return()=>{generation.current++;requestRef.current?.abort();window.removeEventListener('storage',sync);if(timer)clearInterval(timer);};
 },[mode,user?.id]);
 useEffect(()=>{
  if(mode!=='local'||!shops.length)return;
  void checkLocal();const timer=setInterval(()=>void checkLocal(),15*60*1000),visible=()=>{if(document.visibilityState==='visible')void checkLocal();};document.addEventListener('visibilitychange',visible);
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',visible);requestRef.current?.abort();};
 },[mode,shops,user?.id]);
 async function save(){
  if(busy||unresolved)return;const config=watchInput({name,items:basket.map(({code,qty,name})=>({code,qty,name})),shopIds,loyalty,direction,threshold});if(!config){setError('Adj nevet, válassz pontos termékeket és 1–8 figyelt üzletet.');return;}
  const token=generation.current;setBusy(true);setError('');setMessage('');
  try{if(mode==='cloud'){
   const r=await fetch('/api/watches',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(config)}),d=await r.json();if(!r.ok)throw Error(d.error);await reloadCloud(token);
  }else{
   const data=localWatches(localStorage.getItem(WATCH_KEY));if(data.watches.length>=3)throw Error('Ezen az eszközön legfeljebb 3 figyelést menthetsz.');const watch:LocalWatch={id:crypto.randomUUID(),config,prices:{},checkedAt:null};data.watches.unshift(watch);localStorage.setItem(WATCH_KEY,JSON.stringify(data));showLocal(data);
  }
  if(token===generation.current)setMessage(mode==='local'?'Helyi figyelés mentve. Az első ellenőrzés rögzíti a kiinduló árakat.':'Figyelés mentve. Az első háttérellenőrzés még várakozik.');
  if(mode==='local')void checkLocal();
  }catch(e){if(token===generation.current)setError(e instanceof Error?e.message:'A mentés nem sikerült.');}finally{setBusy(false);}
 }
 async function remove(id:string){if(!window.confirm('Törlöd ezt az árfigyelést és a hozzá tartozó jelzéseket?'))return;const token=generation.current;setBusy(true);setError('');try{if(mode==='cloud'){const r=await fetch(`/api/watches?id=${encodeURIComponent(id)}`,{method:'DELETE'});if(!r.ok)throw Error('A törlés nem sikerült.');await reloadCloud(token);}else{const d=localWatches(localStorage.getItem(WATCH_KEY));d.watches=d.watches.filter(w=>w.id!==id);d.notices=d.notices.filter(n=>n.watchId!==id);localStorage.setItem(WATCH_KEY,JSON.stringify(d));showLocal(d);}}catch(e){if(token===generation.current)setError(e instanceof Error?e.message:'A törlés nem sikerült.');}finally{setBusy(false);}}
 async function readAll(){const token=generation.current;setError('');try{if(mode==='cloud'){const r=await fetch('/api/watches',{method:'PATCH'});if(!r.ok)throw Error('Nem sikerült olvasottnak jelölni.');await reloadCloud(token);}else{const d=localWatches(localStorage.getItem(WATCH_KEY));d.notices=d.notices.map(n=>({...n,read:true}));localStorage.setItem(WATCH_KEY,JSON.stringify(d));showLocal(d);}}catch(e){if(token===generation.current)setError(e instanceof Error?e.message:'Nem sikerült.');}}
 return <section className="card watch-section" id="price-alerts"><div className="section-title"><span className="step">5</span><h2>Árfigyelés a kedvenc üzleteidben</h2><span className="badge" aria-live="polite">{notices.filter(n=>!n.read).length} új jelzés</span></div>
  <p>Az app ugyanannak a terméknek, ugyanannak a kiszerelésnek az árát figyeli minden kiválasztott üzletben.</p>
  <div className="watch-mode"><button aria-pressed={mode==='local'} onClick={()=>setMode('local')}>Ezen az eszközön</button><button disabled={!user||!configured} aria-pressed={mode==='cloud'} onClick={()=>setMode('cloud')}>Háttérben, a fiókomban</button></div>
  <p className={mode==='local'?'warning':'hint'}>{mode==='local'?'A helyi figyelés az oldal megnyitásakor és nyitott, látható oldalon 15 percenként ellenőriz. Bezárt app mellett nem fut, és nem küld push- vagy e-mail-értesítést.':'A háttérfigyelő időzített ellenőrzéseinek jelzései itt jelennek meg. A háttérellenőrzés idejét alább látod. Push és e-mail még nem érhető el.'}</p>
  {!configured&&<p className="hint">A bezárt app mellett futó háttérfigyelés még nincs bekapcsolva.</p>}{configured&&!user&&<p className="hint"><a href="/account">Jelentkezz be</a> a háttérfigyeléshez.</p>}
  <div className="travel-fields"><label>Mely üzleteket figyeljük?<select value={scope} onChange={e=>setScope(e.target.value as 'favorites'|'selected')}><option value="favorites">Kedvenc üzleteim</option><option value="selected">Az összehasonlításhoz kijelölt üzletek</option></select></label><label>Mikor jelezzünk?<select value={direction} onChange={e=>setDirection(e.target.value as WatchConfig['direction'])}><option value="all">Bármilyen árváltozás</option><option value="down">Csak árcsökkenés</option><option value="up">Csak áremelkedés</option></select></label><label>Legalább ekkora változás (Ft / csomag)<input type="number" min="0" max="100000" value={threshold} onChange={e=>setThreshold(Math.max(0,Math.min(100000,Number(e.target.value)||0)))}/></label></div>
  <details><summary>{shopIds.length} figyelésre választott üzlet</summary>{shopIds.map(id=><p key={id}>{shopLabel(id)}</p>)}</details>
  {!shopIds.length&&<p className="hint">Jelölj csillaggal kedvenc üzleteket, vagy válaszd a kijelölt üzleteket.</p>}{shopIds.length>8&&<p className="warning">Egy figyeléshez legfeljebb 8 üzlet választható. Szűkítsd a kijelölést.</p>}
  <button className="primary watch-save" disabled={busy||!basket.length||!!unresolved||shopIds.length<1||shopIds.length>8} onClick={()=>void save()}>A „{name||'kosár'}” árainak figyelése</button>
  <p className="hint">A figyelés a mostani termékeket, üzleteket és hűségkártyákat menti. Későbbi kosár- vagy kedvencmódosításhoz készíts új figyelést. A jelzési határ az előző sikeres ellenőrzéshez képest értendő.</p>
  {error&&<p className="error" role="alert">{error}</p>}{message&&<p className="success" role="status">{message}</p>}
  <div className="watch-list">{watches.map(w=><article key={w.id}><div><strong>{w.config.name}</strong><p>{w.config.items.length} termék · {w.config.shopIds.length} üzlet · {w.config.direction==='all'?'Minden változás':w.config.direction==='down'?'Árcsökkenés':'Áremelkedés'}</p><small>{w.checkedAt?`Utolsó ellenőrzési kísérlet: ${stamp(w.checkedAt)}`:'Első ellenőrzésre vár.'}{w.status==='unavailable'?' · Az árforrás nem adott használható árat.':w.status==='partial'?' · Részleges áradatok.':''}</small>{w.checkedAt&&Date.now()-Date.parse(w.checkedAt)>36*3600000&&<p className="warning">Több mint 36 órája nem ellenőriztük. Az árfigyelés frissessége nem biztosított.</p>}<details><summary>Figyelt üzletek és termékek</summary>{w.config.shopIds.map(id=><p key={id}>{shopLabel(id)}</p>)}{w.config.items.map(i=><p key={i.code}>{i.qty} × {i.name}</p>)}</details></div><button disabled={busy} onClick={()=>void remove(w.id)}>Törlés</button></article>)}</div>
  {!!watches.length&&mode==='local'&&<button disabled={checking} onClick={()=>void checkLocal()}>{checking?'Árak ellenőrzése…':'Figyelt árak ellenőrzése most'}</button>}
  <div className="notification-heading"><h3>Árváltozások</h3>{notices.some(n=>!n.read)&&<button onClick={()=>void readAll()}>Mindet olvastam</button>}</div>
  {!notices.length&&<p className="empty">Még nincs árváltozásjelzés. Az első sikeres ellenőrzés a kiinduló árakat rögzíti.</p>}
  <div className="notice-list">{notices.map(n=><article className={n.read?'':'unread'} key={n.id}><div><strong>{n.productName}</strong><p>{shopLabel(n.shopId)}</p><small>{n.watchName} · Észlelve: {stamp(n.observedAt)}</small>{(n.oldKind==='LOYALTY'||n.newKind==='LOYALTY')&&<small>Hűségkártyával elérhető árat is figyelembe vettünk.</small>}</div><div className={n.newPrice<n.oldPrice?'price-down':'price-up'}><span>{ft(n.oldPrice)} → <b>{ft(n.newPrice)}</b></span><small>{n.newPrice<n.oldPrice?'Csökkent':'Emelkedett'}: {ft(Math.abs(n.newPrice-n.oldPrice))} / csomag</small></div></article>)}</div>
  {!!notices.length&&<><p className="hint">Az összegek csomagonként, visszaváltási díjjal értendők. A változás az észlelés idején ismert árra vonatkozik, nem készletigazolás.</p><button disabled={!basket.length} onClick={onRefresh}>Aktuális kosár és bevásárlási ajánlás frissítése</button></>}
 </section>;
}
