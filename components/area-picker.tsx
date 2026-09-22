'use client';
import {useEffect,useState} from 'react';
import type {Area,Place} from '../lib/location';
export function AreaPicker({value,onChange}:{value:Area;onChange:(value:Area)=>void}){
 const [query,setQuery]=useState(value.place?.name||''),[places,setPlaces]=useState<Place[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [radius,setRadius]=useState(String(value.radius));
 useEffect(()=>{if(value.place)setQuery(value.place.name);setRadius(String(value.radius));},[value.place?.id,value.radius]);
 useEffect(()=>{const c=new AbortController();setPlaces([]);setError('');if(query.trim().length<2||query===value.place?.name){setBusy(false);return;}
  setBusy(true);const t=setTimeout(async()=>{try{const r=await fetch('/api/places?'+new URLSearchParams({q:query}),{signal:c.signal});const d=await r.json();if(!r.ok)throw Error(d.error?.message||'Nem sikerült keresni.');if(!c.signal.aborted)setPlaces(d.places);}catch(e){if(!c.signal.aborted)setError(e instanceof Error?e.message:'Nem sikerült keresni.');}finally{if(!c.signal.aborted)setBusy(false);}},350);
  return()=>{clearTimeout(t);c.abort();};
 },[query,value.place?.name]);
 return <div className="area-picker">
  <div><label htmlFor="city-query">Város / település</label><input id="city-query" type="search" value={query} placeholder="Pl. Nyékládháza, Miskolc, Budapest" onChange={e=>{setQuery(e.target.value);if(value.place)onChange({...value,place:null});}}/>
  {busy&&<p role="status" className="hint">Települések keresése…</p>}{error&&<p role="alert" className="error">{error}</p>}
  {!!places.length&&<div className="place-options" aria-label="Talált települések">{places.map(p=><button key={p.id} onClick={()=>{setQuery(p.name);setPlaces([]);onChange({...value,place:p});}}><strong>{p.name}</strong><span>{p.region}</span></button>)}</div>}
  {!busy&&!error&&query.length>=2&&!places.length&&!value.place&&<p className="hint">Nincs találat. Írd ki a település nevét.</p>}
  {value.place&&<p className="hint">Kiválasztva: <strong>{value.place.name}</strong> · {value.place.region}</p>}</div>
  <div><label htmlFor="radius-km">Keresési körzet</label><div className="radius-input"><input id="radius-km" type="number" min="1" max="100" step="1" value={radius} onChange={e=>setRadius(e.target.value)} onBlur={()=>{const n=Math.max(1,Math.min(100,Math.round(Number(radius)||20)));setRadius(String(n));onChange({...value,radius:n});}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/><span>km</span></div>
  <div className="radius-presets">{[5,10,20,50].map(n=><button key={n} aria-pressed={value.radius===n} onClick={()=>{setRadius(String(n));onChange({...value,radius:n});}}>{n} km</button>)}</div></div>
  <p className="hint area-note">Légvonalban, a település központjától. Az autóval megtett út hosszabb lehet. Településadat: <a href="https://open-meteo.com/en/docs/geocoding-api" target="_blank" rel="noreferrer">Open-Meteo / GeoNames</a>.</p>
 </div>;
}
