'use client';
import {useEffect,useState} from 'react';
import type {Category} from '../lib/catalogue';
export function CategoryMenu({onSelect,selected}:{onSelect:(id:number,name:string)=>void;selected:number|null}){
 const [roots,setRoots]=useState<Category[]>([]),[trail,setTrail]=useState<Category[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
 useEffect(()=>{const c=new AbortController();setLoading(true);setError('');fetch('/api/categories',{signal:c.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error?.message||'Nem tölthetők be a kategóriák.');setRoots(d.categories);}).catch(e=>{if(!c.signal.aborted)setError(e.message);}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[retry]);
 const nodes=trail.length?trail[trail.length-1].children:roots;
 return <div className="category-browser"><nav className="breadcrumbs" aria-label="Kategória útvonala"><button onClick={()=>setTrail([])}>Minden kategória</button>{trail.map((n,i)=><button key={n.id} onClick={()=>setTrail(t=>t.slice(0,i+1))}>› {n.name}</button>)}</nav>
  {loading&&<p role="status">Kategóriák betöltése…</p>}{error&&<p className="error" role="alert">{error} <button onClick={()=>setRetry(v=>v+1)}>Újrapróbálom</button></p>}
  <div className="category-grid">{nodes.map(n=><button className={selected===n.id?'active':''} aria-pressed={!n.children.length?selected===n.id:undefined} key={n.id} onClick={()=>n.children.length?setTrail(t=>[...t,n]):onSelect(n.id,n.name)}><span>{n.name}</span><b aria-hidden="true">{n.children.length?'›':'+'}</b></button>)}</div>
 </div>;
}
