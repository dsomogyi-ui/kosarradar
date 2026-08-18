"use client";
import {useEffect,useState} from "react";
type Product={code:string;product_name:string;brands?:string;quantity?:string;image_front_small_url?:string};
type Basket=Product&{qty:number};
type PriceResult={code:string;name:string;qty:number;available:boolean;price?:number;lineTotal?:number;url?:string;reason?:string};

const ft=new Intl.NumberFormat("hu-HU",{style:"currency",currency:"HUF",maximumFractionDigits:0});

export default function Home(){
 const[q,setQ]=useState(""); const[results,setResults]=useState<Product[]>([]); const[basket,setBasket]=useState<Basket[]>([]);
 const[loading,setLoading]=useState(false); const[calc,setCalc]=useState(false); const[priceResults,setPriceResults]=useState<PriceResult[]>([]);
 const[priceLoading,setPriceLoading]=useState(false);

 useEffect(()=>{if(q.trim().length<2){setResults([]);return}const t=setTimeout(async()=>{setLoading(true);try{const r=await fetch("/api/products/search?q="+encodeURIComponent(q));const d=await r.json();setResults(d.products||[])}finally{setLoading(false)}},650);return()=>clearTimeout(t)},[q]);

 const add=(p:Product)=>setBasket(b=>{const e=b.find(x=>x.code===p.code);return e?b.map(x=>x.code===p.code?{...x,qty:x.qty+1}:x):[...b,{...p,qty:1}]});
 const qty=(c:string,n:number)=>setBasket(b=>b.map(x=>x.code===c?{...x,qty:x.qty+n}:x).filter(x=>x.qty>0));

 async function calculate(){
  setCalc(true);setPriceLoading(true);
  const rows:PriceResult[]=[];
  for(const item of basket){
   try{
    const r=await fetch("/api/prices/auchan?code="+encodeURIComponent(item.code),{cache:"no-store"});
    const d=await r.json();
    rows.push({code:item.code,name:item.product_name,qty:item.qty,available:!!d.available,price:d.price,lineTotal:d.available?d.price*item.qty:undefined,url:d.url,reason:d.reason});
   }catch{rows.push({code:item.code,name:item.product_name,qty:item.qty,available:false,reason:"error"})}
  }
  setPriceResults(rows);setPriceLoading(false);
 }
 const pricedTotal=priceResults.filter(x=>x.available).reduce((s,x)=>s+(x.lineTotal||0),0);
 const missing=priceResults.filter(x=>!x.available).length;

 return <main>
  <header><div className="brand"><span className="logo">KR</span><div><b>KosárRadar</b><small>A valódi megtakarítás számít.</small></div></div><span className="version">Alpha 0.4</span></header>
  <section className="hero"><small>BEVÁSÁRLÓLISTA + ÉLŐ ÁR</small><h1>Mit szeretnél vásárolni?</h1><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Próbáld: Perwoll, Cappy, Somat..."/><p>A termékadat és az árforrás külön rendszer. Az első élő retailer kapcsolat: Auchan.</p></section>

  <div className="grid">
   <section className="card">
    <div className="head"><h2>Találatok</h2>{loading&&<span>keresés…</span>}</div>
    {results.map(p=><article key={p.code}><div className="image">{p.image_front_small_url?<img src={p.image_front_small_url} alt=""/>:"▧"}</div><div className="info"><b>{p.product_name}</b><span>{[p.brands,p.quantity].filter(Boolean).join(" • ")}</span><small>{p.code}</small></div><button onClick={()=>add(p)}>+ Kosárba</button></article>)}
   </section>

   <aside className="card">
    <div className="head"><h2>Bevásárlólistám</h2><span>{basket.reduce((s,x)=>s+x.qty,0)} db</span></div>
    {!basket.length?<div className="empty">Még nincs termék a listán.</div>:basket.map(x=><div className="basketrow" key={x.code}><div><b>{x.product_name}</b><span>{x.quantity}</span></div><div className="counter"><button onClick={()=>qty(x.code,-1)}>−</button><b>{x.qty}</b><button onClick={()=>qty(x.code,1)}>+</button></div></div>)}
    <button className="cta" disabled={!basket.length||priceLoading} onClick={calculate}>{priceLoading?"Árak lekérése…":"Hol éri meg?"}</button>
   </aside>
  </div>

  {calc&&<section className="card result">
   <div className="head"><h2>Auchan – aktuális online kosár</h2><span>LIVE</span></div>
   {priceLoading?<div className="empty">Élő árak lekérése…</div>:<>
    {priceResults.map(x=><div className="pricerow" key={x.code}><div><b>{x.name}</b><span>{x.qty} db</span></div>{x.available?<div className="right"><b>{ft.format(x.lineTotal||0)}</b><small>{ft.format(x.price||0)} / db</small>{x.url&&<a href={x.url} target="_blank">forrás ↗</a>}</div>:<div className="missing">Nincs még Auchan-kapcsolat</div>}</div>)}
    <div className="total"><span>Ismert tételek összege</span><b>{ft.format(pricedTotal)}</b></div>
    {missing>0&&<div className="warning">{missing} tételhez még nincs Auchan termékazonosítás, ezért a kosár nem teljes.</div>}
    <div className="disclaimer"><b>Fontos:</b> Az árak online forrásból származnak. Az áruházban érvényes polci ár, készlet, valamint a hűségkártyás és személyre szabott kedvezmény eltérhet.</div>
   </>}
  </section>}
 </main>
}