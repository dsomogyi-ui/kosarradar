"use client";
import { useEffect, useState } from "react";

type Product = {
  code:string; product_name:string; brands?:string; quantity?:string;
  image_front_small_url?:string; source?:"openfoodfacts"|"kosarradar";
};
type Basket = Product & { qty:number };

export default function Home(){
  const [q,setQ]=useState("");
  const [results,setResults]=useState<Product[]>([]);
  const [basket,setBasket]=useState<Basket[]>([]);
  const [loading,setLoading]=useState(false);
  const [status,setStatus]=useState("");

  useEffect(()=>{
    if(q.trim().length<2){setResults([]);setStatus("");return}
    const timer=setTimeout(async()=>{
      setLoading(true); setStatus("");
      try{
        const r=await fetch(`/api/products/search?q=${encodeURIComponent(q.trim())}`);
        const d=await r.json();
        setResults(d.products||[]);
        if(d.meta?.openfoodfacts_status==="unavailable")
          setStatus("A nyilvános termékadatbázis átmenetileg nem válaszol; a KosárRadar saját terméktörzséből mutatjuk a találatokat.");
      }catch{
        setResults([]);
        setStatus("A keresés most nem érhető el.");
      }finally{setLoading(false)}
    },650);
    return()=>clearTimeout(timer);
  },[q]);

  const add=(p:Product)=>setBasket(cur=>{
    const found=cur.find(x=>x.code===p.code);
    return found
      ? cur.map(x=>x.code===p.code?{...x,qty:x.qty+1}:x)
      : [...cur,{...p,qty:1}];
  });

  const changeQty=(code:string,delta:number)=>setBasket(cur=>
    cur.map(x=>x.code===code?{...x,qty:x.qty+delta}:x).filter(x=>x.qty>0)
  );

  return <main>
    <header>
      <div className="brand"><span className="logo">KR</span><div><b>KosárRadar</b><small>A valódi megtakarítás számít.</small></div></div>
      <span className="version">Alpha 0.3.1</span>
    </header>

    <section className="hero">
      <small>BEVÁSÁRLÓLISTA</small>
      <h1>Mit szeretnél vásárolni?</h1>
      <input value={q} onChange={e=>setQ(e.target.value)}
        placeholder="Próbáld: Cappy, Perwoll, Somat, Nutella..." />
      <p>Termékadat: KosárRadar Product Master + Open Food Facts. Árakat nem ebből veszünk.</p>
    </section>

    <div className="grid">
      <section className="card">
        <div className="head"><h2>Találatok</h2>{loading&&<span>keresés…</span>}</div>
        {status&&<div className="notice">{status}</div>}
        {!loading && q.length>=2 && results.length===0 && <div className="empty">Nincs találat. Próbálj márkanevet vagy egyszerűbb keresést.</div>}
        {results.map(p=><article key={p.code}>
          <div className="image">{p.image_front_small_url?<img src={p.image_front_small_url} alt=""/>:<span>▧</span>}</div>
          <div className="info">
            <b>{p.product_name}</b>
            <span>{[p.brands,p.quantity].filter(Boolean).join(" • ")}</span>
            <small>{p.code.startsWith("KR-")?"KosárRadar terméktörzs":`EAN ${p.code}`}</small>
          </div>
          <button onClick={()=>add(p)}>+ Kosárba</button>
        </article>)}
      </section>

      <aside className="card">
        <div className="head"><h2>Bevásárlólistám</h2><span>{basket.reduce((a,x)=>a+x.qty,0)} db</span></div>
        {basket.length===0?<div className="empty">Még nincs termék a listán.</div>:
          basket.map(x=><div className="basketrow" key={x.code}>
            <div><b>{x.product_name}</b><span>{x.quantity||x.brands}</span></div>
            <div className="counter"><button onClick={()=>changeQty(x.code,-1)}>−</button><b>{x.qty}</b><button onClick={()=>changeQty(x.code,1)}>+</button></div>
          </div>)
        }
        <button className="cta" disabled={!basket.length}>Hol éri meg?</button>
        <p className="muted">Következő modul: hivatalos kereskedői árforrások összekapcsolása EAN/GTIN alapján.</p>
      </aside>
    </div>
  </main>
}