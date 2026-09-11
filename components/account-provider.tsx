'use client';
import {createContext,useContext,useEffect,useRef,useState,useCallback,type ReactNode} from 'react';
import {allowedFavoriteId} from '../lib/retailers';
import {createBrowserClient} from '@supabase/ssr';
import type {SupabaseClient} from '@supabase/supabase-js';
type User={id:string;email:string;displayName:string;favoriteShopIds:string[]};
type Config={configured:boolean;url?:string;key?:string;google?:boolean;facebook?:boolean;email?:boolean;signup?:boolean;error?:string};
type State={client:SupabaseClient|null;config:Config|null;user:User|null;favorites:string[];busy:boolean;error:string;refresh:()=>Promise<void>;save:(ids:string[],name?:string)=>Promise<boolean>};
const Context=createContext<State|null>(null);
const GUEST='kosarradar:guest-favorites:v1';
export function AccountProvider({children}:{children:ReactNode}){
 const [client,setClient]=useState<SupabaseClient|null>(null),[config,setConfig]=useState<Config|null>(null),[user,setUser]=useState<User|null>(null),[favorites,setFavorites]=useState<string[]>([]),[busy,setBusy]=useState(true),[error,setError]=useState('');
 const generation=useRef(0),saving=useRef(false);
 const guest=()=>{try{const d=JSON.parse(localStorage.getItem(GUEST)||'[]');return Array.isArray(d)?d.filter(allowedFavoriteId).slice(0,50):[];}catch{return [];}};
 const refresh=useCallback(async()=>{const token=++generation.current;setBusy(true);setUser(null);setFavorites([]);setError('');
  try{const r=await fetch('/api/account',{cache:'no-store'});const d=await r.json();if(token!==generation.current)return;
   if(r.status===401){setFavorites(guest());return;}if(!r.ok)throw Error(d.error||'A fiók nem tölthető be.');setUser(d.user);setFavorites(d.user.favoriteShopIds);
  }catch(e){if(token===generation.current)setError(e instanceof Error?e.message:'A fiók nem tölthető be.');}finally{if(token===generation.current)setBusy(false);}
 },[]);
 useEffect(()=>{let stopped=false;let unsubscribe:(()=>void)|undefined;
  fetch('/api/auth/config',{cache:'no-store'}).then(r=>r.json()).then((c:Config)=>{if(stopped)return;setConfig(c);
   if(!c.configured||!c.url||!c.key){setFavorites(guest());setBusy(false);return;}
   const db=createBrowserClient(c.url,c.key);setClient(db);
   const {data}=db.auth.onAuthStateChange(()=>{void refresh();});unsubscribe=()=>data.subscription.unsubscribe();
  }).catch(()=>{if(!stopped){setConfig({configured:false,error:'A bejelentkezés állapota nem tölthető be.'});setFavorites(guest());setBusy(false);}});
  return()=>{stopped=true;unsubscribe?.();generation.current++;};
 },[refresh]);
 async function save(ids:string[],name?:string){if(busy||saving.current||error&&!user&&config?.configured)return false;if(ids.length>50){setError('Legfeljebb 50 kedvenc üzlet menthető.');return false;}
  saving.current=true;setBusy(true);setError('');const token=generation.current;
  try{if(user){const r=await fetch('/api/account',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({displayName:name??user.displayName,favoriteShopIds:ids})});if(!r.ok){const d=await r.json();throw Error(d.error||'Nem sikerült menteni.');}
    if(token===generation.current)setUser({...user,displayName:name??user.displayName,favoriteShopIds:ids});
   }else{localStorage.setItem(GUEST,JSON.stringify(ids));}
   if(token===generation.current)setFavorites(ids);return true;
  }catch(e){if(token===generation.current)setError(e instanceof Error?e.message:'Nem sikerült menteni.');return false;}finally{saving.current=false;if(token===generation.current)setBusy(false);}
 }
 return <Context.Provider value={{client,config,user,favorites,busy,error,refresh,save}}>{children}</Context.Provider>;
}
export function useAccount(){const state=useContext(Context);if(!state)throw Error('AccountProvider missing');return state;}
export function AccountLink(){const {user,busy}=useAccount();return <a className="account-link" href="/account">{busy?'Fiók…':user?user.displayName||'Fiókom':'Belépés / regisztráció'}</a>;}
