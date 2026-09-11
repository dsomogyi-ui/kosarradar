'use client';
import { useEffect, useRef, useState } from 'react';
import type { BasketItem, Product } from '../lib/types';
import { normalize, packageChoice, parseNeed, selectedBasket, splitList, type ShoppingLine } from '../lib/shopping-text';
import { restore } from '../lib/storage';
import { CategoryMenu } from './category-menu';

const KEY = 'kosarradar:text-list:v1', RECENT = 'kosarradar:recent-products:v1';
type Props = { initialBasket: BasketItem[]; onChange: (basket: BasketItem[], pending: number) => void };
export function FreeTextList({ initialBasket, onChange }: Props) {
  const [lines, setLines] = useState<ShoppingLine[]>([]), [draft, setDraft] = useState(''), [active, setActive] = useState('');
  const [ready, setReady] = useState(false), [message, setMessage] = useState(''), [storageError, setStorageError] = useState('');
  const [products, setProducts] = useState<Product[]>([]), [loading, setLoading] = useState(false), [error, setError] = useState(''), [stale, setStale] = useState(false);
  const [offset, setOffset] = useState(0), [hasMore, setHasMore] = useState(false), [retry, setRetry] = useState(0);
  const [category, setCategory] = useState<number | null>(null), [recent, setRecent] = useState<Record<string, string>>({});
  const notify = useRef(onChange); notify.current = onChange;
  const initial = useRef(initialBasket);
  const current = lines.find(l => l.id === active), need = parseNeed(current?.text || '');
  const query = need.query, preferenceKey = normalize(query);

  useEffect(() => {
    let restored = initial.current.map(p => ({ id: crypto.randomUUID(), text: `${p.name}, ${p.qty} db`, selected: p } as ShoppingLine));
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved: unknown = JSON.parse(raw);
        if (!Array.isArray(saved) || saved.length > 24) throw Error();
        restored = saved.map(item => {
          if (!item || typeof item.text !== 'string' || item.text.length > 200) throw Error();
          const selected = item.selected && restore(JSON.stringify({ basket: [item.selected], shopIds: [], loyalty: [], extraStopCost: 0 }))?.basket[0];
          return { id: crypto.randomUUID(), text: item.text, selected: selected || undefined };
        });
        if (selectedBasket(restored).some(p => p.qty > 99)) throw Error();
      }
      const prefs = JSON.parse(localStorage.getItem(RECENT) || '{}');
      if (prefs && typeof prefs === 'object' && !Array.isArray(prefs)) setRecent(Object.fromEntries(Object.entries(prefs).filter(([k, v]) => k.length <= 100 && typeof v === 'string' && /^[\w-]{1,64}$/.test(v)).slice(-100)) as Record<string, string>);
    } catch { restored = initial.current.map(p => ({ id: crypto.randomUUID(), text: `${p.name}, ${p.qty} db`, selected: p })); setStorageError('A korábbi szöveges lista nem tölthető be teljesen. Ellenőrizd a tételeket.'); }
    setLines(restored); setActive(restored[0]?.id || ''); setReady(true);
    notify.current(selectedBasket(restored), restored.filter(l => !l.selected).length);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, JSON.stringify(lines)); localStorage.setItem(RECENT, JSON.stringify(recent)); }
    catch { setStorageError('A böngésző nem tudja menteni a listát. Bezáráskor elveszhet.'); }
  }, [lines, recent, ready]);

  useEffect(() => {
    const c = new AbortController(); setProducts([]); setHasMore(false); setError(''); setStale(false);
    if (!active || (!category && (query.length < 3 || need.error))) { setLoading(false); return () => c.abort(); }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const url = category ? '/api/products/category?' + new URLSearchParams({ id: String(category), offset: String(offset) }) : '/api/products/suggestions?' + new URLSearchParams({ q: query, offset: String(offset) });
        const response = await fetch(url, { signal: c.signal, cache: 'no-store' }), d = await response.json();
        if (!response.ok) throw Error(d.error?.message || 'A terméklista nem tölthető be.');
        if (!c.signal.aborted) { setProducts(d.products); setHasMore(d.hasMore); setStale(d.stale); }
      } catch (e) { if (!c.signal.aborted) setError(e instanceof Error ? e.message : 'A terméklista nem tölthető be.'); }
      finally { if (!c.signal.aborted) setLoading(false); }
    }, 350);
    return () => { clearTimeout(timer); c.abort(); };
  }, [query, active, category, offset, retry, need.error]);

  function update(next: ShoppingLine[]) {
    const basket = selectedBasket(next);
    if (basket.some(p => p.qty > 99)) { setMessage('Azonos termékből összesen legfeljebb 99 csomag választható.'); return false; }
    setLines(next); notify.current(basket, next.filter(l => !l.selected).length); return true;
  }
  function focus(id: string, reveal = false) { setActive(id); setOffset(0); setCategory(null); setMessage(''); if (reveal && window.matchMedia('(max-width: 760px)').matches) requestAnimationFrame(() => document.getElementById('suggestions-title')?.scrollIntoView({ block: 'start' })); }
  function append(text: string) {
    const incoming = splitList(text);
    if (!incoming.length) return;
    if (lines.length + incoming.length > 24 || incoming.some(t => t.length > 200)) { setMessage('Legfeljebb 24 tételt adj meg, soronként legfeljebb 200 karakterrel.'); return; }
    const added = incoming.map(text => ({ id: crypto.randomUUID(), text }));
    if (update([...lines, ...added])) { focus(added[0].id, true); setDraft(''); }
  }
  function choose(p: Product) {
    if (!current) return;
    const choice = packageChoice(need, p);
    if (choice.error) { setMessage(choice.error); return; }
    if (update(lines.map(l => l.id === active ? { ...l, selected: { ...p, qty: choice.qty } } : l))) {
      setRecent(prev => Object.fromEntries([...Object.entries(prev).filter(([k]) => k !== preferenceKey), [preferenceKey, p.code]].slice(-100)));
      setMessage(`${p.name}: ${choice.label}. Az árak automatikusan frissülnek, ha már választottál üzleteket.`);
    }
  }
  const shown = [...products].sort((a, b) => Number(b.code === recent[preferenceKey]) - Number(a.code === recent[preferenceKey]));
  return <div className="text-workspace">
    <section className="card text-shopping" aria-labelledby="text-list-title">
      <div className="section-title"><span className="step">1</span><h2 id="text-list-title">Bevásárlólistám</h2><span className="badge">{lines.length} tétel</span></div>
      <form onSubmit={e => { e.preventDefault(); append(draft); }}>
        <label htmlFor="shopping-text">Írd le, mire van szükséged</label>
        <textarea id="shopping-text" rows={3} maxLength={4800} value={draft} onChange={e => setDraft(e.target.value)} placeholder={'Cappy almalé, 2 liter\nTej, 1 liter\nKenyér, 1 db'} />
        <div className="text-actions"><button className="primary" disabled={!ready || !draft.trim()}>Hozzáadás a listához</button><button type="button" disabled={!ready || lines.length >= 24} onClick={() => append('Cappy almalé, 2 liter')}>Cappy-példa kipróbálása</button></div>
      </form>
      <p className="hint">Új sorral, pontosvesszővel vagy vesszővel is elválaszthatod a tételeket. A mennyiséget mértékegységgel írd.</p>
      {!lines.length && <p className="empty">A listád még üres. Írj be egy terméket, vagy indítsd a Cappy-példát.</p>}
      <div className="need-list">{lines.map((line, i) => <article className={'need-row ' + (line.id === active ? 'active' : '')} key={line.id}>
        <div className="need-heading"><label htmlFor={'need-' + line.id}>{i + 1}. tétel</label><button className="remove-need" aria-label={`${line.text} törlése`} onClick={() => { const next = lines.filter(l => l.id !== line.id); update(next); if (active === line.id) focus(next[0]?.id || ''); }}>×</button></div>
        <input id={'need-' + line.id} value={line.text} maxLength={200} onFocus={() => { if (active !== line.id) focus(line.id); }} onChange={e => { update(lines.map(l => l.id === line.id ? { ...l, text: e.target.value, selected: undefined } : l)); setOffset(0); setCategory(null); }} />
        {line.selected ? <><p className="chosen-product"><strong>{line.selected.name}</strong><span>{line.selected.qty} × {line.selected.packaging.replace('.', ',')} {line.selected.unit}</span></p><button className="pick-need" onClick={() => focus(line.id)}>Másik változat választása →</button></> : <button className="pick-need" onClick={() => focus(line.id)}>Kiválasztásra vár · Termékek megtekintése →</button>}
      </article>)}</div>
      {storageError && <p className="warning" role="alert">{storageError}</p>}
      <p className="hint">A szöveges listát és a korábbi termékválasztást ezen az eszközön jegyezzük meg.</p>
    </section>
    <section className="card suggestions-panel" aria-labelledby="suggestions-title">
      <div className="section-title"><span className="step">2</span><h2 id="suggestions-title">{current ? 'Válassz konkrét terméket' : 'Ide kerülnek a javaslatok'}</h2></div>
      {current ? <>
        <div className="need-summary"><strong>{need.query || 'Terméknév szükséges'}</strong><span>Igény: {need.amount.toLocaleString('hu-HU')} {need.unit} · Auchan és Tesco</span></div>
        {need.error && <p className="warning">{need.error}</p>}
        <details className="alternative-categories"><summary>Inkább kategóriából választok</summary><CategoryMenu selected={category} onSelect={id => { setCategory(id); setOffset(0); }} />{category && <button onClick={() => { setCategory(null); setOffset(0); }}>Vissza a beírt termékhez</button>}</details>
        {category && <p className="warning">Most a teljes kategóriát látod. Más márkát is választhatsz, de csak a saját kattintásoddal kerül a listára.</p>}
        {loading && <p role="status" className="empty">Megfelelő termékek keresése…</p>}
        {error && <p className="error" role="alert">{error} <button onClick={() => setRetry(v => v + 1)}>Újrapróbálom</button></p>}
        {stale && <p className="warning">Korábbi terméklista. A kiválasztás után külön ellenőrizzük az árakat.</p>}
        {!loading && !error && !need.error && !shown.length && <p className="empty">{hasMore ? 'Ezen az oldalon nincs megfelelő változat. Lapozz tovább.' : 'Nincs megfelelő találat. Pontosítsd a nevet, vagy válassz a kategóriákból.'}</p>}
        <div className="suggestion-products">{shown.map(p => { const choice = packageChoice(need, p); return <article className={'suggestion-product ' + (current.selected?.code === p.code ? 'chosen' : '')} key={p.code}>
          {p.imageUrl && <img src={p.imageUrl} alt="" loading="lazy" />}
          <div><strong>{p.name}</strong><span>{p.packaging.replace('.', ',')} {p.unit}</span>{recent[preferenceKey] === p.code && <small className="badge">Korábban ezt választottad</small>}<p className="package-choice">{choice.error || choice.label}</p><button disabled={!!choice.error || loading} onClick={() => choose(p)}>{current.selected?.code === p.code ? 'Kiválasztva ✓' : 'Ezt választom'}</button></div>
        </article>; })}</div>
        {(offset > 0 || hasMore) && <nav className="pagination" aria-label="Termékjavaslatok lapozása"><button disabled={!offset || loading} onClick={() => setOffset(n => Math.max(0, n - (category ? 20 : 100)))}>Előző</button><button disabled={!hasMore || loading} onClick={() => setOffset(n => n + (category ? 20 : 100))}>További termékek</button></nav>}
        <p className="hint">Az árakat a kiválasztás után, a megjelölt üzletekre számoljuk. Nem helyettesítünk automatikusan más termékkel.</p>
      </> : <p className="empty">Írj a listára például „Cappy almalé, 2 liter”, majd itt válaszd ki a pontos változatot.</p>}
      {message && <p className="success" role="status">{message}</p>}
    </section>
  </div>;
}
