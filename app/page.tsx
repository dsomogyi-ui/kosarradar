'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { BasketItem, Chain, Comparison, Plan, Product, Shop } from '../lib/types';
import { eligiblePrice, optimize } from '../lib/optimizer';
import { restore, STORAGE_KEY } from '../lib/storage';
import { FreeTextList } from '../components/free-text-list';
import { AreaPicker } from '../components/area-picker';
import { BasketSaves } from '../components/basket-saves';
import { nearbyShops, validPlace, type Area } from '../lib/location';
import type { ShoppingLine } from '../lib/shopping-text';
import type { BasketSnapshot } from '../lib/saved-baskets';
import { AccountLink,useAccount } from '../components/account-provider';

const ft = new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 2 });
const stamp = (s: string) => new Date(s).toLocaleString('hu-HU', { timeZone: 'Europe/Budapest', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const size = (p: Product) => [p.packaging.replace('.', ','), p.unit].filter(Boolean).join(' ');
async function api<T>(url: string, signal: AbortSignal, body?: unknown): Promise<T> {
  const response = await fetch(url, { signal, cache: 'no-store', ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'A lekérés nem sikerült. Próbáld újra.');
  return data;
}
export default function Home() {
  const {user,favorites,busy:accountBusy,error:accountError,save:saveFavorites}=useAccount();
  const [area,setArea]=useState<Area>({place:null,radius:20}),[basketName,setBasketName]=useState('Heti bevásárlás'),[lines,setLines]=useState<ShoppingLine[]>([]),[loadedLines,setLoadedLines]=useState<ShoppingLine[]|undefined>();
  const [completedShops,setCompletedShops]=useState(0);
  const [onlyFavorites,setOnlyFavorites]=useState(false),[unresolved,setUnresolved]=useState(0);
  const [basket, setBasket] = useState<BasketItem[]>([]), [shops, setShops] = useState<Shop[]>([]), [chains, setChains] = useState<Chain[]>([]);
  const [shopIds, setShopIds] = useState<string[]>([]), [loyalty, setLoyalty] = useState<string[]>([]), [extraStopCost, setExtraStopCost] = useState(0);
  const [chainFilter, setChainFilter] = useState(''), [shopsError, setShopsError] = useState(''), [shopsLoading, setShopsLoading] = useState(true), [shopsStale, setShopsStale] = useState(false), [retryShops, setRetryShops] = useState(0);
  const [ready, setReady] = useState(false), [storageError, setStorageError] = useState(''), [notice, setNotice] = useState('');
  const [comparison, setComparison] = useState<Comparison | null>(null), [priceLoading, setPriceLoading] = useState(false), [compareError, setCompareError] = useState('');
  const calculation = useRef<AbortController | null>(null), revision = useRef(0);
  const selectedShops = useMemo(() => shopIds.flatMap(id => shops.find(s => s.id === id) || []), [shopIds, shops]);
  const selectedChains = chains.filter(c => selectedShops.some(s => s.chainId === c.id));
  const nearby=useMemo(()=>nearbyShops(shops,area),[shops,area]);
  const filteredShops=useMemo(()=>nearby.filter(s=>(!onlyFavorites||favorites.includes(s.id))&&(!chainFilter||s.chainId===chainFilter)),[nearby,onlyFavorites,favorites,chainFilter]);
  const unknownLocations=shops.filter(s=>s.latitude===undefined||s.longitude===undefined).length;
  const distance=(id:string)=>nearby.find(s=>s.id===id)?.distance;
  const km=(id:string)=>{const n=distance(id);return n===undefined?'':`${n.toLocaleString('hu-HU',{maximumFractionDigits:1})} km`;};


  useEffect(() => {
    try { const raw = localStorage.getItem(STORAGE_KEY), saved = restore(raw); if (saved) { setBasket(saved.basket); setShopIds(saved.shopIds); setLoyalty(saved.loyalty); setExtraStopCost(saved.extraStopCost); } else if (raw) setStorageError('A korábbi mentés nem olvasható. Új listát készíthetsz.'); }
    catch { setStorageError('Ebben a böngészőben a lista mentése nem elérhető.'); }
    try{const loc=JSON.parse(localStorage.getItem('kosarradar:area:v1')||'null');if(loc&&(loc.place===null||validPlace(loc.place))&&Number.isInteger(loc.radius)&&loc.radius>=1&&loc.radius<=100)setArea(loc);}catch{}
    setReady(true);
    return () => calculation.current?.abort();
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ basket, shopIds, loyalty, extraStopCost })); }
    catch { setStorageError('A lista mentése nem sikerült; az oldal bezárásakor elveszhet.'); }
  }, [ready, basket, shopIds, loyalty, extraStopCost]);
  useEffect(()=>{if(!ready)return;try{localStorage.setItem('kosarradar:area:v1',JSON.stringify(area));}catch{setStorageError('A helyszín nem menthető ezen az eszközön.');}},[area,ready]);
  useEffect(()=>{if(!ready||shopsLoading)return;invalidate();setShopIds(filteredShops.map(s=>s.id));},[filteredShops,ready,shopsLoading]);
  useEffect(() => {
    const controller = new AbortController(); setShopsLoading(true); setShopsError('');
    api<{ shops: Shop[]; chains: Chain[]; stale: boolean }>('/api/shops', controller.signal)
      .then(d => { if (!controller.signal.aborted) { setShops(d.shops); setShopIds(ids=>ids.filter(id=>d.shops.some(s=>s.id===id))); setLoyalty(ids=>ids.filter(id=>d.chains.some(c=>c.id===id))); setChains(d.chains.sort((a, b) => a.name.localeCompare(b.name, 'hu'))); setShopsStale(d.stale); } })
      .catch(e => { if (!controller.signal.aborted) setShopsError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setShopsLoading(false); });
    return () => controller.abort();
  }, [retryShops]);
  useEffect(() => {
    if (!ready || shopsLoading || !basket.length || !selectedShops.length || selectedShops.length !== shopIds.length) return;
    const timer = setTimeout(() => { void calculate(); }, 650);
    return () => { clearTimeout(timer); calculation.current?.abort(); };
  }, [ready, shopsLoading, basket, shopIds, loyalty, extraStopCost]);


  function invalidate() { revision.current++; calculation.current?.abort(); setComparison(null); setPriceLoading(false); setCompareError(''); }
  function toggleShop(id: string) { invalidate(); setShopIds(ids => ids.includes(id) ? ids.filter(s => s !== id) : [...ids, id]); }
  function toggleLoyalty(id: string) { invalidate(); setLoyalty(ids => ids.includes(id) ? ids.filter(s => s !== id) : [...ids, id]); }
  async function calculate() {
    calculation.current?.abort(); const controller = new AbortController(); calculation.current = controller;
    const token = ++revision.current; setCompletedShops(0); setPriceLoading(true); setComparison(null); setCompareError('');
    try {
      const results: Comparison[]=[];
      // Keep upstream requests bounded; every selected shop gets a result, not only the first eight.
      for(let offset=0;offset<shopIds.length;offset+=8){
        const data=await api<Comparison>('/api/compare',controller.signal,{items:basket.map(({code,qty})=>({code,qty})),shopIds:shopIds.slice(offset,offset+8),loyaltyChainIds:loyalty,extraStopCost});
        if(controller.signal.aborted||token!==revision.current)return;
        results.push(data);setCompletedShops(Math.min(offset+8,shopIds.length));
      }
      const quotes=results.flatMap(r=>r.quotes),oldest=results.map(r=>r.oldestObservation).filter((v):v is string=>!!v).sort()[0]||null;
      const data:Comparison={quotes,products:results[0]?.products||[],plans:optimize(basket,selectedShops,quotes,loyalty,extraStopCost),comparedAt:new Date().toISOString(),oldestObservation:oldest,warnings:[...new Set(results.flatMap(r=>r.warnings))]};
      if(!controller.signal.aborted&&token===revision.current)setComparison(data);
    } catch (e) { if (!controller.signal.aborted && token === revision.current) setCompareError(e instanceof Error ? e.message : 'A számítás nem sikerült.'); }
    finally { if (!controller.signal.aborted && token === revision.current) setPriceLoading(false); }
  }
  function loadBasket(s:BasketSnapshot){invalidate();setBasketName(s.name);setArea(s.area);setLoyalty(s.loyalty);setExtraStopCost(s.extraStopCost);setOnlyFavorites(false);setChainFilter('');setLoadedLines(s.lines);window.scrollTo({top:0,behavior:'smooth'});}
  const complete = comparison?.plans.filter(p => p.complete) || [];
  const single = complete.find(p => p.shopIds.length === 1), pair = complete.find(p => p.shopIds.length === 2), best = complete[0];
  const labelShop = (id: string) => shops.find(s => s.id === id);
  const productName = (id: string) => basket.find(p => p.code === id)?.name || id;
  const renderPlan = (p: Plan, title: string) => <article className={'plan ' + (p === best ? 'best' : '')} key={p.id}>
    <div className="eyebrow">{title}{p === best && <span className="badge">Kedvezőbb választás</span>}</div>
    <h3>{p.shopIds.map(id => labelShop(id)?.name).join(' + ')}</h3>
    {p.shopIds.map(id => { const s = labelShop(id); return <p className="muted address" key={id}>{s?.city}, {s?.address}</p>; })}
    <div className="plan-total">{ft.format(p.total)}</div>
    <dl><div><dt>Termékek</dt><dd>{ft.format(p.subtotal)}</dd></div><div><dt>Visszaváltási díj</dt><dd>{ft.format(p.deposits)}</dd></div><div><dt>Második megálló</dt><dd>{ft.format(p.travel)}</dd></div></dl>
    <details><summary>Tételes bevásárlólista</summary>{p.lines.map(l => <div className="allocation" key={l.code}><strong>{productName(l.code)}</strong><span>{l.qty} csomag × {ft.format(l.unitPrice)} · {labelShop(l.shopId)?.name}{l.priceKind === 'LOYALTY' ? ' · hűségárral' : l.priceKind === 'DISCOUNTED' ? ' · akciós árral' : ''}</span><b>{ft.format(l.total)}</b></div>)}</details>
  </article>;

  return <main>
    <header><a className="brand" href="/" aria-label="KosárRadar kezdőlap"><span className="logo">KR</span><b>KosárRadar</b></a><div className="header-actions"><span className="version">Alpha 0.8</span><AccountLink/></div></header>
    <div className="intro compact-intro"><div><h1>A te listád. <span>A környéked árai.</span></h1><p>Állítsd össze és mentsd el a kosaradat, majd nézd meg, hol éri meg.</p></div></div>
    <nav className="journey" aria-label="Bevásárlás lépései"><a href="#basket-builder">1. Kosár összeállítása</a><a href="#save-basket">2. Kosár mentése</a><a href="#stores">3. Üzletek és árak</a></nav>
    <section className="basket-name" id="basket-builder"><label htmlFor="basket-name">Kosár neve</label><input id="basket-name" maxLength={80} value={basketName} onChange={e=>setBasketName(e.target.value)}/></section>
    {ready ? <FreeTextList initialBasket={basket} loadedLines={loadedLines} onChange={(next, pending, nextLines) => { invalidate(); setBasket(next); setUnresolved(pending);setLines(nextLines); }} /> : <p role="status">Bevásárlólista betöltése…</p>}
    <section className="card save-card" id="save-basket"><div className="section-title"><span className="step">2</span><h2>Kosár mentése</h2></div><BasketSaves snapshot={{name:basketName,lines,area,loyalty,extraStopCost}} onLoad={loadBasket}/></section>
    <section className="card basket-summary" aria-label="Kosár számítási állapota">
      <div><strong>{basket.reduce((n,p)=>n+p.qty,0)} kiválasztott csomag · {selectedShops.length} üzlet</strong><p className="hint">{unresolved ? `${unresolved} tétel még kiválasztásra vár. Az eredmény csak részösszeg.` : basket.length ? 'A kiválasztás vagy a beállítások módosításakor automatikusan újraszámolunk.' : 'Válassz konkrét terméket az árak kiszámításához.'}</p></div>
      {!selectedShops.length ? <a className="button-link" href="#stores">Válassz települést és körzetet ↓</a> : <button disabled={!basket.length || priceLoading || shopsLoading} onClick={calculate}>{priceLoading ? 'Árak frissítése…' : 'Árak újraellenőrzése'}</button>}
      {storageError && <p className="warning" role="alert">{storageError}</p>}
    </section>
    <p className="sr-only" role="status" aria-live="polite">{notice}</p>
    <section className="card stores" id="stores" aria-labelledby="stores-title"><div className="section-title"><span className="step">3</span><h2 id="stores-title">Auchan és Tesco a közeledben</h2><span className="muted">{shopIds.length} üzlet</span></div>
      <AreaPicker value={area} onChange={next=>{invalidate();setArea(next);setOnlyFavorites(false);setChainFilter('');}}/>
      {shopsLoading && <p role="status">Üzletek betöltése…</p>}
      {shopsError && <div className="error" role="alert">{shopsError} <button onClick={() => setRetryShops(n => n + 1)}>Újrapróbálom</button></div>}
      {shopsStale && <p className="warning">Korábban lekért üzletlista.</p>}
      {!!shops.length&&area.place&&<>
        <div className="store-filters"><strong>{filteredShops.length} üzlet · {area.place.name}, {area.radius} km</strong><label htmlFor="chain">Lánc</label><select id="chain" value={chainFilter} onChange={e=>setChainFilter(e.target.value)}><option value="">Auchan és Tesco</option>{chains.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select><button aria-pressed={onlyFavorites} onClick={()=>setOnlyFavorites(v=>!v)}>★ Csak kedvenceim</button><button onClick={()=>{invalidate();setShopIds(filteredShops.map(s=>s.id));}}>Mind kijelölése</button></div>
        <p className="hint">Minden találatot kijelölünk. A pipával kihagyhatsz üzleteket; a csillaggal kedvencet menthetsz.</p>
        {accountError&&<p className="error" role="alert">{accountError}</p>}
        {!filteredShops.length&&<p className="empty">Nincs {onlyFavorites?'kedvenc ':''}üzlet ebben a körzetben. Növeld a távolságot vagy módosítsd a szűrőt.</p>}
        <div className="nearby-store-list">{filteredShops.map(s=>{
          const plan=comparison&&shopIds.includes(s.id)?optimize(basket,[s],comparison.quotes,loyalty,0)[0]:null;
          const full=!!plan?.complete&&!unresolved;
          return <article className={'nearby-store '+(shopIds.includes(s.id)?'selected':'')} key={s.id}>
            <label className="store-choice"><input type="checkbox" checked={shopIds.includes(s.id)} onChange={()=>toggleShop(s.id)}/><span><strong>{s.name} <small>{km(s.id)}</small></strong><span>{s.postalCode} {s.city}, {s.address}</span></span></label>
            <div className="store-price">{plan?<><strong>{plan.lines.length?ft.format(plan.total):'Nincs áradat'}</strong><span className={full?'complete-label':'missing'}>{full?'Teljes kosár':`${plan.lines.length} / ${basket.length+unresolved} tétel · részleges`}</span>{plan.lines.length>0&&<small>Visszaváltási díjjal</small>}</>:<span>{!shopIds.includes(s.id)?'Kihagyva':priceLoading?'Árak lekérése…':basket.length?'Összehasonlításra vár':'Válassz terméket az árhoz'}</span>}</div>
            <button className="favorite-toggle" disabled={accountBusy} aria-pressed={favorites.includes(s.id)} aria-label={`${s.name}, ${s.address}: kedvenc`} onClick={()=>void saveFavorites(favorites.includes(s.id)?favorites.filter(id=>id!==s.id):[...favorites,s.id])}>{favorites.includes(s.id)?'★':'☆'}</button>
          </article>;
        })}</div>
      </>}
      {!area.place&&<p className="empty">Válassz települést a kereső találatai közül. Ezután megjelennek a körzet boltjai.</p>}
      {unknownLocations>0&&<p className="warning">{unknownLocations} üzletnél hiányzik az ellenőrizhető helyadat; ezeket nem tudjuk távolság szerint besorolni.</p>}
      <p className="source-note">A GVH Árfigyelőben szereplő Auchan és Tesco üzletek. Az adatforráson kívüli boltok és termékek nem jelennek meg.</p>
      {!!selectedShops.length && <div className="preferences"><fieldset><legend>Melyik láncnál van hűségkártyád?</legend><div className="loyalty">{selectedChains.map(c => <label key={c.id}><input type="checkbox" checked={loyalty.includes(c.id)} onChange={() => toggleLoyalty(c.id)}/>{c.name}</label>)}</div><p className="hint">Csak a megjelölt láncok általános hűségáraival számolunk. Egyéni kuponokat nem vonunk le.</p></fieldset><div><label htmlFor="extra-cost">Második megálló többletköltsége</label><div className="cost-input"><input id="extra-cost" type="number" min="0" max="100000" step="50" value={extraStopCost} onChange={e => { invalidate(); setExtraStopCost(Math.min(100000, Math.max(0, Number(e.target.value) || 0))); }}/><span>Ft</span></div><p className="hint">Saját becslés az extra útra és időre. A 0 Ft azt jelenti, hogy ezeket nem számoljuk.</p></div></div>}
    </section>
    {(priceLoading || compareError || comparison) && <section className="card comparison" aria-labelledby="compare-title"><div className="section-title"><h2 id="compare-title">{unresolved ? "A kiválasztott tételek részösszege" : "Így alakul a kosarad"}</h2></div>
      {priceLoading && <p className="empty" role="status">Ellenőrizzük az árakat: {completedShops} / {shopIds.length} üzlet…</p>}
      {compareError && <div className="error" role="alert">{compareError} <button onClick={calculate}>Újrapróbálom</button></div>}
      {comparison && <>{unresolved > 0 && <p className="warning"><strong>Ez még nem a teljes bevásárlólista ára.</strong> {unresolved} tételnél konkrét terméket kell választanod.</p>}{comparison.warnings.map(w => <p className="warning" key={w}>{w}</p>)}
        {best ? <><p className="result-summary">{unresolved ? "Az alábbi összegek csak a már kiválasztott tételeket tartalmazzák." : single && pair && pair.total < single.total ? <>Két üzlettel <b>{ft.format(single.total - pair.total)}</b> maradhat nálad az egyboltos megoldáshoz képest.</> : single ? 'A legkedvezőbb teljes kosárhoz elég egy üzlet.' : 'A teljes kosár két üzletből állítható össze.'}</p><div className="plans">{single && renderPlan(single, unresolved ? 'EGY ÜZLET · RÉSZÖSSZEG' : 'EGY ÜZLET')}{pair && renderPlan(pair, unresolved ? 'KÉT ÜZLET · RÉSZÖSSZEG' : 'KÉT ÜZLET')}</div>{!single && <p className="hint">Egyetlen kiválasztott üzletben sincs minden tételhez használható ár.</p>}{!pair && <p className="hint">A második üzlet bevonása nem ad külön, teljes kosaras megoldást.</p>}</> : <div className="warning"><strong>Még nincs teljes kosár.</strong><p>Legalább egy tételhez hiányzik a használható ár, vagy a kosár több mint két üzletet igényel. A részösszegek nem hasonlíthatók egy teljes kosárhoz.</p></div>}
        <details className="coverage" open={!best}><summary>Árak és hiányzó tételek üzletenként</summary><div className="table-scroll"><table><thead><tr><th>Termék / csomag</th>{selectedShops.map(s => <th key={s.id}>{s.name}<small>{s.city}, {s.address}</small></th>)}</tr></thead><tbody>{basket.map(p => <tr key={p.code}><th>{p.name}<small>{p.qty} db · {size(p)}</small></th>{selectedShops.map(s => { const quote = comparison.quotes.find(v => v.code === p.code && v.shopId === s.id), price = quote && eligiblePrice(quote.prices, loyalty.includes(s.chainId)); const reason = quote?.status === 'error' ? 'Lekérési hiba' : quote?.status === 'stale' ? 'Elavult ár' : quote?.status === 'unsupported' ? 'Nem számolható' : quote?.status === 'ok' && !price ? 'Nincs jogosult ár' : 'Nincs áradat'; return <td key={s.id}>{quote?.status === 'ok' && price ? <><b>{ft.format(price.amount)}</b>{price.type === 'LOYALTY' && <small>Hűségár</small>}{price.type === 'DISCOUNTED' && <small>Akciós ár</small>}{quote.returnFee > 0 && <small>+ {ft.format(quote.returnFee)} visszaváltási díj</small>}</> : <span className="missing">{reason}</span>}</td>; })}</tr>)}</tbody></table></div></details>
        <p className="source-note">Forrás: <a href="https://arfigyelo.gvh.hu" target="_blank" rel="noreferrer">GVH Árfigyelő</a>. {comparison.oldestObservation && <>A felhasznált lekérések közül a legrégebbi: {stamp(comparison.oldestObservation)} (budapesti idő).</>} Ez a lekérés ideje, nem a bolti ár módosításának időpontja.</p>
        <p className="hint">Az ár megléte nem jelent készletigazolást. Indulás előtt ellenőrizd az ajánlatot és a kedvezmény feltételeit. Az első üzlethez vezető út költsége nincs benne.</p>
      </>}
    </section>}
    <footer><span>KosárRadar · Alpha 0.8</span><a href="https://arfigyelo.gvh.hu" target="_blank" rel="noreferrer">Áradatok: GVH Árfigyelő ↗</a></footer>
  </main>;
}
