'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { BasketItem, Chain, Comparison, Plan, Product, Shop } from '../lib/types';
import { eligiblePrice } from '../lib/optimizer';
import { restore, STORAGE_KEY } from '../lib/storage';
import { CategoryMenu } from '../components/category-menu';
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
  const [onlyFavorites,setOnlyFavorites]=useState(false),[category,setCategory]=useState<number|null>(null),[categoryName,setCategoryName]=useState(''),[hasMore,setHasMore]=useState(false);
  const [q, setQ] = useState(''), [offset, setOffset] = useState(0), [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false), [searchError, setSearchError] = useState(''), [searchStale, setSearchStale] = useState(false), [retrySearch, setRetrySearch] = useState(0);
  const [basket, setBasket] = useState<BasketItem[]>([]), [shops, setShops] = useState<Shop[]>([]), [chains, setChains] = useState<Chain[]>([]);
  const [shopIds, setShopIds] = useState<string[]>([]), [loyalty, setLoyalty] = useState<string[]>([]), [extraStopCost, setExtraStopCost] = useState(0);
  const [shopQuery, setShopQuery] = useState(''), [chainFilter, setChainFilter] = useState(''), [shopsError, setShopsError] = useState(''), [shopsLoading, setShopsLoading] = useState(true), [shopsStale, setShopsStale] = useState(false), [retryShops, setRetryShops] = useState(0);
  const [ready, setReady] = useState(false), [storageError, setStorageError] = useState(''), [notice, setNotice] = useState('');
  const [comparison, setComparison] = useState<Comparison | null>(null), [priceLoading, setPriceLoading] = useState(false), [compareError, setCompareError] = useState('');
  const calculation = useRef<AbortController | null>(null), revision = useRef(0), searchRevision = useRef(0);
  const selectedShops = useMemo(() => shopIds.flatMap(id => shops.find(s => s.id === id) || []), [shopIds, shops]);
  const selectedChains = chains.filter(c => selectedShops.some(s => s.chainId === c.id));
  const filteredShops = useMemo(() => shops.filter(s => (!onlyFavorites||favorites.includes(s.id)) && (!chainFilter || s.chainId === chainFilter) && (!shopQuery.trim() || fold(`${s.name} ${s.postalCode} ${s.city} ${s.address}`).includes(fold(shopQuery.trim())))), [shops, chainFilter, shopQuery,onlyFavorites,favorites]);
  const visibleShops = filteredShops.slice(0, 40);

  useEffect(() => {
    try { const raw = localStorage.getItem(STORAGE_KEY), saved = restore(raw); if (saved) { setBasket(saved.basket); setShopIds(saved.shopIds); setLoyalty(saved.loyalty); setExtraStopCost(saved.extraStopCost); } else if (raw) setStorageError('A korábbi mentés nem olvasható. Új listát készíthetsz.'); }
    catch { setStorageError('Ebben a böngészőben a lista mentése nem elérhető.'); }
    setReady(true);
    return () => calculation.current?.abort();
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ basket, shopIds, loyalty, extraStopCost })); }
    catch { setStorageError('A lista mentése nem sikerült; az oldal bezárásakor elveszhet.'); }
  }, [ready, basket, shopIds, loyalty, extraStopCost]);
  useEffect(() => {
    const controller = new AbortController(); setShopsLoading(true); setShopsError('');
    api<{ shops: Shop[]; chains: Chain[]; stale: boolean }>('/api/shops', controller.signal)
      .then(d => { if (!controller.signal.aborted) { setShops(d.shops); setShopIds(ids=>ids.filter(id=>d.shops.some(s=>s.id===id))); setLoyalty(ids=>ids.filter(id=>d.chains.some(c=>c.id===id))); setChains(d.chains.sort((a, b) => a.name.localeCompare(b.name, 'hu'))); setShopsStale(d.stale); } })
      .catch(e => { if (!controller.signal.aborted) setShopsError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setShopsLoading(false); });
    return () => controller.abort();
  }, [retryShops]);
  useEffect(() => {
    const controller = new AbortController(), token = ++searchRevision.current;
    setResults([]); setHasMore(false); setSearchError(''); setSearchStale(false);
    if (!category && q.trim().length < 3) { setLoading(false); return () => controller.abort(); }
    setLoading(true);
    const timer = setTimeout(() => {
      api<{ products: Product[]; hasMore: boolean; stale: boolean }>(category ? '/api/products/category?' + new URLSearchParams({id:String(category),offset:String(offset)}) : '/api/products/search?' + new URLSearchParams({ q: q.trim(), offset: String(offset) }), controller.signal)
        .then(d => { if (!controller.signal.aborted && token === searchRevision.current) { setResults(d.products); setHasMore(d.hasMore); setSearchStale(d.stale); } })
        .catch(e => { if (!controller.signal.aborted && token === searchRevision.current) setSearchError(e.message); })
        .finally(() => { if (!controller.signal.aborted && token === searchRevision.current) setLoading(false); });
    }, 450);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [q, offset, retrySearch,category]);

  function invalidate() { revision.current++; calculation.current?.abort(); setComparison(null); setPriceLoading(false); setCompareError(''); }
  function add(p: Product) {
    if (!p.priceable) return;
    const existing = basket.find(i => i.code === p.code);
    if (!existing && basket.length >= 24) { setNotice('Egy összehasonlításban legfeljebb 24 különböző termék lehet.'); return; }
    if (existing && existing.qty >= 99) return;
    invalidate(); setBasket(b => existing ? b.map(i => i.code === p.code ? { ...i, qty: i.qty + 1 } : i) : [...b, { ...p, qty: 1 }]); setNotice(`${p.name} a listára került.`);
  }
  function quantity(code: string, change: number) { invalidate(); setBasket(b => b.map(i => i.code === code ? { ...i, qty: Math.min(99, i.qty + change) } : i).filter(i => i.qty > 0)); }
  function toggleShop(id: string) { if (!shopIds.includes(id) && shopIds.length >= 8) { setNotice('Legfeljebb 8 üzletet válassz.'); return; } invalidate(); setShopIds(ids => ids.includes(id) ? ids.filter(s => s !== id) : [...ids, id]); }
  function toggleLoyalty(id: string) { invalidate(); setLoyalty(ids => ids.includes(id) ? ids.filter(s => s !== id) : [...ids, id]); }
  async function calculate() {
    calculation.current?.abort(); const controller = new AbortController(); calculation.current = controller;
    const token = ++revision.current; setPriceLoading(true); setComparison(null); setCompareError('');
    try {
      const data = await api<Comparison>('/api/compare', controller.signal, { items: basket.map(({ code, qty }) => ({ code, qty })), shopIds, loyaltyChainIds: loyalty, extraStopCost });
      if (!controller.signal.aborted && token === revision.current) setComparison(data);
    } catch (e) { if (!controller.signal.aborted && token === revision.current) setCompareError(e instanceof Error ? e.message : 'A számítás nem sikerült.'); }
    finally { if (!controller.signal.aborted && token === revision.current) setPriceLoading(false); }
  }
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
    <header><a className="brand" href="/" aria-label="KosárRadar kezdőlap"><span className="logo">KR</span><b>KosárRadar</b></a><div className="header-actions"><span className="version">Alpha 0.6</span><AccountLink/></div></header>
    <div className="intro"><div><p className="eyebrow">BEVÁSÁRLÁS, KISZÁMOLVA</p><h1>Ugyanaz a kosár.<br/><span>Kedvezőbb végösszeg.</span></h1></div><p>Állítsd össze a listád, válaszd ki az üzleteidet,<br className="desktop"/> és nézd meg, megéri-e két helyre menni.</p></div>
    <div className="workspace">
      <section className="card catalogue" aria-labelledby="search-title">
        <div className="section-title"><span className="step">1</span><h2 id="search-title">Mi kerüljön a kosárba?</h2></div>
        <p className="hint">Válassz kategóriát, majd egy pontos kiszerelést. Auchan · Tesco</p>
        <CategoryMenu selected={category} onSelect={(id,name)=>{setCategory(id);setCategoryName(name);setQ('');setOffset(0);}}/>
        <label className="search-label" htmlFor="search">Termék neve vagy vonalkódja</label>
        <input id="search" type="search" maxLength={100} value={q} onChange={e => { setQ(e.target.value); setCategory(null); setOffset(0); }} placeholder="Termék vagy vonalkód, pl. Perwoll" autoComplete="off"/>
        <p className="hint">A pontos kiszerelést válaszd ki. Egy darab egy teljes csomagot jelent.</p>
        {category && <div className="selected-category"><strong>{categoryName}</strong><button onClick={()=>{setCategory(null);setOffset(0);}}>Kiválasztás törlése ×</button></div>}
        {!category && q.length < 3 && <p className="empty">Nyiss meg egy kategóriát a fenti menüben.<br/>Név vagy vonalkód alapján is kereshetsz, legalább 3 karakterrel.</p>}
        {loading && <p className="empty" role="status">Termékek keresése…</p>}
        {searchError && <div className="error" role="alert">{searchError} <button onClick={() => setRetrySearch(n => n + 1)}>Újrapróbálom</button></div>}
        {searchStale && <p className="warning">A terméklista korábbi lekérésből származik. Az árakat külön ellenőrizzük.</p>}
        {!loading && !searchError && (category||q.trim().length >= 3) && !results.length && <p className="empty">{hasMore?'Ezen az oldalon nincs termék a két kiválasztott lánctól. Lapozz tovább.':'Nincs további találat a két lánc kínálatában. Válassz másik kategóriát vagy keresőkifejezést.'}</p>}
        {!!results.length && <div className="result-meta"><span>{results.length} termék ezen az oldalon</span><span>{Math.floor(offset/20)+1}. oldal</span></div>}
        <div className="product-list">{results.map(p => <article className="product" key={p.code}><div className="product-image">{p.imageUrl && <img src={p.imageUrl} alt="" loading="lazy" onError={e => { e.currentTarget.style.visibility = 'hidden'; }}/>}</div><div className="product-info"><strong>{p.name}</strong><span>{size(p)}</span><small>Azonosító: {p.code}</small>{p.bulk && <small>Kimért termék: ebben a verzióban még nem számolható.</small>}</div><button className="add" disabled={!p.priceable || !ready} aria-label={`${p.name} kosárba`} onClick={() => add(p)}>+<span> Kosárba</span></button></article>)}</div>
        {(offset > 0 || hasMore) && <nav className="pagination" aria-label="Találati oldalak"><button disabled={!offset || loading} onClick={() => setOffset(n => Math.max(0, n - 20))}>Előző</button><button disabled={!hasMore || loading} onClick={() => setOffset(n => n + 20)}>Következő</button></nav>}
      </section>
      <aside className="card basket" aria-labelledby="basket-title"><div className="section-title"><h2 id="basket-title">Bevásárlólistám</h2><span className="badge">{basket.reduce((n, p) => n + p.qty, 0)} db</span></div>
        {!basket.length && <div className="empty">A listád még üres.<br/>Válassz termékeket a kategóriákból.</div>}
        {basket.map(p => <div className="basket-row" key={p.code}><div><strong>{p.name}</strong><span>{size(p)}</span></div><div className="counter"><button aria-label={`${p.name} mennyiségének csökkentése`} onClick={() => quantity(p.code, -1)}>−</button><output aria-label={`${p.name} darabszáma`}>{p.qty}</output><button disabled={p.qty >= 99} aria-label={`${p.name} mennyiségének növelése`} onClick={() => quantity(p.code, 1)}>+</button></div></div>)}
        <div className="basket-footer"><span>{selectedShops.length} kiválasztott üzlet</span><button className="primary" disabled={!ready || !basket.length || !selectedShops.length || selectedShops.length !== shopIds.length || priceLoading || shopsLoading} onClick={calculate}>{priceLoading ? 'Árak összehasonlítása…' : 'Hol éri meg vásárolni?'}</button>{!selectedShops.length && <a href="#stores">Válassz üzleteket az összehasonlításhoz ↓</a>}<small>A listát és a beállításokat ezen az eszközön mentjük.</small></div>
        {storageError && <p className="warning" role="alert">{storageError}</p>}
      </aside>
    </div>
    <p className="sr-only" role="status" aria-live="polite">{notice}</p>
    <section className="card stores" id="stores" aria-labelledby="stores-title"><div className="section-title"><span className="step">2</span><h2 id="stores-title">Melyik üzletek jöhetnek szóba?</h2><span className="muted">{shopIds.length} / 8</span></div>
      <p className="hint">Auchan és Tesco. Konkrét üzletek árait hasonlítjuk össze. Keress településre, irányítószámra vagy címre.</p>
      {shopsLoading && <p role="status">Üzletek betöltése…</p>}
      {shopsError && <div className="error" role="alert">{shopsError} <button onClick={() => setRetryShops(n => n + 1)}>Újrapróbálom</button></div>}
      {shopsStale && <p className="warning">Korábban lekért üzletlista.</p>}
      {!!shops.length && <><div className="store-controls"><label className="sr-only" htmlFor="town">Település, irányítószám vagy cím</label><input id="town" type="search" value={shopQuery} onChange={e => setShopQuery(e.target.value)} placeholder="Pl. Budapest, 2040 vagy Kossuth utca"/><label className="sr-only" htmlFor="chain">Üzletlánc</label><select id="chain" value={chainFilter} onChange={e => setChainFilter(e.target.value)}><option value="">Minden elérhető lánc</option>{chains.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></div>
        <div className="favorites-toolbar"><button aria-pressed={onlyFavorites} onClick={()=>setOnlyFavorites(v=>!v)}>★ Kedvenceim ({favorites.filter(id=>shops.some(s=>s.id===id)).length})</button><button disabled={accountBusy||!favorites.some(id=>shops.some(s=>s.id===id))} onClick={()=>{invalidate();const ids=favorites.filter(id=>shops.some(s=>s.id===id));setShopIds(ids.slice(0,8));if(ids.length>8)setNotice('Az első 8 kedvenc üzletet választottuk ki.');}}>Kedvencek kijelölése</button><span>{user?'Kedvencek a fiókodba mentve':'Kedvencek ezen az eszközön · a fiókhoz jelentkezz be'}</span></div>
        {accountError&&<p className="error" role="alert">{accountError}</p>}
        {!!shopIds.length && <div className="selected-stores">{shopIds.map(id => { const s = labelShop(id); return <button className="chip" key={id} onClick={() => toggleShop(id)} aria-label={`${s?.name || id} ${s?.address || ''} eltávolítása`}>{s ? `${s.name} · ${s.city}, ${s.address}` : 'Már nem elérhető üzlet'} <span>×</span></button>; })}</div>}
        {(shopQuery.trim() || chainFilter || onlyFavorites) ? <><div className="store-list">{visibleShops.map(s => <div className={'store-option ' + (shopIds.includes(s.id) ? 'selected' : '')} key={s.id}><label className="store-choice"><input type="checkbox" checked={shopIds.includes(s.id)} disabled={!shopIds.includes(s.id) && shopIds.length >= 8} onChange={() => toggleShop(s.id)}/><span><strong>{s.name}</strong><span>{s.postalCode} {s.city}, {s.address}</span></span></label><button className="favorite-toggle" disabled={accountBusy} aria-pressed={favorites.includes(s.id)} aria-label={`${s.name}, ${s.address}: ${favorites.includes(s.id)?'eltávolítás a kedvencekből':'mentés a kedvencek közé'}`} onClick={()=>void saveFavorites(favorites.includes(s.id)?favorites.filter(id=>id!==s.id):[...favorites,s.id])}>{favorites.includes(s.id)?'★':'☆'}</button></div>)}</div>{!filteredShops.length && <p className="empty">Ezen a néven vagy címen nincs találat.</p>}{filteredShops.length > 40 && <p className="hint">Az első 40 üzlet látszik. Pontosítsd a települést vagy a címet.</p>}</> : <p className="store-prompt">Írd be, hol vásárolnál, majd jelöld ki az üzleteket.</p>}
      </>}
      <p className="source-note">Ebben a prototípusban kizárólag az Auchan és Tesco üzletei választhatók.</p>
      {!!selectedShops.length && <div className="preferences"><fieldset><legend>Melyik láncnál van hűségkártyád?</legend><div className="loyalty">{selectedChains.map(c => <label key={c.id}><input type="checkbox" checked={loyalty.includes(c.id)} onChange={() => toggleLoyalty(c.id)}/>{c.name}</label>)}</div><p className="hint">Csak a megjelölt láncok általános hűségáraival számolunk. Egyéni kuponokat nem vonunk le.</p></fieldset><div><label htmlFor="extra-cost">Második megálló többletköltsége</label><div className="cost-input"><input id="extra-cost" type="number" min="0" max="100000" step="50" value={extraStopCost} onChange={e => { invalidate(); setExtraStopCost(Math.min(100000, Math.max(0, Number(e.target.value) || 0))); }}/><span>Ft</span></div><p className="hint">Saját becslés az extra útra és időre. A 0 Ft azt jelenti, hogy ezeket nem számoljuk.</p></div></div>}
    </section>
    {(priceLoading || compareError || comparison) && <section className="card comparison" aria-labelledby="compare-title"><div className="section-title"><span className="step">3</span><h2 id="compare-title">Így alakul a kosarad</h2></div>
      {priceLoading && <p className="empty" role="status">Ellenőrizzük az árakat a kiválasztott üzletekben…</p>}
      {compareError && <div className="error" role="alert">{compareError} <button onClick={calculate}>Újrapróbálom</button></div>}
      {comparison && <>{comparison.warnings.map(w => <p className="warning" key={w}>{w}</p>)}
        {best ? <><p className="result-summary">{single && pair && pair.total < single.total ? <>Két üzlettel <b>{ft.format(single.total - pair.total)}</b> maradhat nálad az egyboltos megoldáshoz képest.</> : single ? 'A legkedvezőbb teljes kosárhoz elég egy üzlet.' : 'A teljes kosár két üzletből állítható össze.'}</p><div className="plans">{single && renderPlan(single, 'EGY ÜZLET')}{pair && renderPlan(pair, 'KÉT ÜZLET')}</div>{!single && <p className="hint">Egyetlen kiválasztott üzletben sincs minden tételhez használható ár.</p>}{!pair && <p className="hint">A második üzlet bevonása nem ad külön, teljes kosaras megoldást.</p>}</> : <div className="warning"><strong>Még nincs teljes kosár.</strong><p>Legalább egy tételhez hiányzik a használható ár, vagy a kosár több mint két üzletet igényel. A részösszegek nem hasonlíthatók egy teljes kosárhoz.</p></div>}
        <details className="coverage" open={!best}><summary>Árak és hiányzó tételek üzletenként</summary><div className="table-scroll"><table><thead><tr><th>Termék / csomag</th>{selectedShops.map(s => <th key={s.id}>{s.name}<small>{s.city}, {s.address}</small></th>)}</tr></thead><tbody>{basket.map(p => <tr key={p.code}><th>{p.name}<small>{p.qty} db · {size(p)}</small></th>{selectedShops.map(s => { const quote = comparison.quotes.find(v => v.code === p.code && v.shopId === s.id), price = quote && eligiblePrice(quote.prices, loyalty.includes(s.chainId)); const reason = quote?.status === 'error' ? 'Lekérési hiba' : quote?.status === 'stale' ? 'Elavult ár' : quote?.status === 'unsupported' ? 'Nem számolható' : quote?.status === 'ok' && !price ? 'Nincs jogosult ár' : 'Nincs áradat'; return <td key={s.id}>{quote?.status === 'ok' && price ? <><b>{ft.format(price.amount)}</b>{price.type === 'LOYALTY' && <small>Hűségár</small>}{price.type === 'DISCOUNTED' && <small>Akciós ár</small>}{quote.returnFee > 0 && <small>+ {ft.format(quote.returnFee)} visszaváltási díj</small>}</> : <span className="missing">{reason}</span>}</td>; })}</tr>)}</tbody></table></div></details>
        <p className="source-note">Forrás: <a href="https://arfigyelo.gvh.hu" target="_blank" rel="noreferrer">GVH Árfigyelő</a>. {comparison.oldestObservation && <>A felhasznált lekérések közül a legrégebbi: {stamp(comparison.oldestObservation)} (budapesti idő).</>} Ez a lekérés ideje, nem a bolti ár módosításának időpontja.</p>
        <p className="hint">Az ár megléte nem jelent készletigazolást. Indulás előtt ellenőrizd az ajánlatot és a kedvezmény feltételeit. Az első üzlethez vezető út költsége nincs benne.</p>
      </>}
    </section>}
    <footer><span>KosárRadar · Alpha 0.6</span><a href="https://arfigyelo.gvh.hu" target="_blank" rel="noreferrer">Áradatok: GVH Árfigyelő ↗</a></footer>
  </main>;
}
