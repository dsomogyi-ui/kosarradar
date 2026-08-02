"use client";

import { useMemo, useState } from "react";

type Product = { id: string; name: string; unit: string };
type Store = { id: string; name: string; distanceKm: number; prices: Record<string, number | null> };
type BasketItem = { productId: string; quantity: number };

const PRODUCTS: Product[] = [
  { id: "perwoll75", name: "Perwoll Color", unit: "3,75 l / 75 mosás" },
  { id: "somatgel", name: "Somat mosogatógép gél", unit: "2 × 684 ml" },
  { id: "cappyalma", name: "Cappy almalé", unit: "1 l" },
  { id: "meridol", name: "Meridol Gum Protection", unit: "75 ml" },
  { id: "venus", name: "Gillette Venus Tropical", unit: "3 db" },
  { id: "silan", name: "Silan Sensitive", unit: "1,672 l" },
  { id: "zewa", name: "Zewa Deluxe", unit: "8 tekercs" },
  { id: "pur", name: "Pur mosogatószer", unit: "750 ml" }
];

const STORES: Store[] = [
  { id: "auchan", name: "Auchan", distanceKm: 13, prices: { perwoll75: 4790, somatgel: 4490, cappyalma: 749, meridol: 1499, venus: 1679, silan: 1899, zewa: 2499, pur: 849 } },
  { id: "tesco", name: "Tesco", distanceKm: 11, prices: { perwoll75: 6290, somatgel: 4799, cappyalma: 999, meridol: 1599, venus: 1799, silan: 1999, zewa: 2399, pur: 799 } },
  { id: "ecofamily", name: "EcoFamily", distanceKm: 9, prices: { perwoll75: 6490, somatgel: 3790, cappyalma: 790, meridol: 1519, venus: 1599, silan: 1699, zewa: 2199, pur: 729 } },
  { id: "dm", name: "dm", distanceKm: 10, prices: { perwoll75: 6990, somatgel: 5290, cappyalma: null, meridol: 649, venus: 1489, silan: 1899, zewa: 2299, pur: 899 } },
  { id: "rossmann", name: "Rossmann", distanceKm: 10.5, prices: { perwoll75: 7333, somatgel: 4499, cappyalma: null, meridol: 1399, venus: 1699, silan: 1799, zewa: 2349, pur: 879 } },
  { id: "muller", name: "Müller", distanceKm: 12, prices: { perwoll75: 6890, somatgel: 4990, cappyalma: null, meridol: 1299, venus: 1649, silan: 1849, zewa: 2449, pur: 829 } }
];

const money = new Intl.NumberFormat("hu-HU", { style: "currency", currency: "HUF", maximumFractionDigits: 0 });

function combinations<T>(items: T[]): T[][] {
  const result: T[][] = [];
  items.forEach((item) => result.push([item]));
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) result.push([items[i], items[j]]);
  }
  return result;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [basket, setBasket] = useState<BasketItem[]>([
    { productId: "perwoll75", quantity: 1 },
    { productId: "somatgel", quantity: 1 }
  ]);
  const [selectedStores, setSelectedStores] = useState<string[]>(STORES.map((store) => store.id));
  const [costPerKm, setCostPerKm] = useState(25);
  const [calculated, setCalculated] = useState(false);

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return PRODUCTS;
    return PRODUCTS.filter((product) => `${product.name} ${product.unit}`.toLowerCase().includes(normalized));
  }, [query]);

  function addProduct(productId: string) {
    setBasket((current) => {
      const existing = current.find((item) => item.productId === productId);
      if (existing) return current.map((item) => item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item);
      return [...current, { productId, quantity: 1 }];
    });
    setQuery("");
    setCalculated(false);
  }

  function updateQuantity(productId: string, quantity: number) {
    if (quantity <= 0) {
      setBasket((current) => current.filter((item) => item.productId !== productId));
      return;
    }
    setBasket((current) => current.map((item) => item.productId === productId ? { ...item, quantity } : item));
    setCalculated(false);
  }

  const results = useMemo(() => {
    if (!basket.length || !selectedStores.length) return [];
    return combinations(selectedStores)
      .map((storeIds) => {
        let productCost = 0;
        for (const item of basket) {
          const available = storeIds
            .map((storeId) => {
              const store = STORES.find((entry) => entry.id === storeId);
              const price = store?.prices[item.productId] ?? null;
              return price === null ? null : { storeId, price };
            })
            .filter((entry): entry is { storeId: string; price: number } => entry !== null)
            .sort((a, b) => a.price - b.price);
          if (!available.length) return null;
          productCost += available[0].price * item.quantity;
        }
        const distanceKm = storeIds.reduce((sum, id) => sum + (STORES.find((entry) => entry.id === id)?.distanceKm ?? 0), 0);
        const travelCost = distanceKm * costPerKm;
        return { storeIds, productCost, distanceKm, travelCost, total: productCost + travelCost };
      })
      .filter((result): result is { storeIds: string[]; productCost: number; distanceKm: number; travelCost: number; total: number } => result !== null)
      .sort((a, b) => a.total - b.total)
      .slice(0, 5);
  }, [basket, selectedStores, costPerKm]);

  return (
    <main>
      <header className="topbar">
        <div className="brand"><div className="logo">KR</div><div><strong>KosárRadar</strong><span>A valódi megtakarítás számít.</span></div></div>
        <div className="pill">Alpha 0.1</div>
      </header>

      <section className="hero">
        <div><p className="eyebrow">BEVÁSÁRLÁSI DÖNTÉSTÁMOGATÁS</p><h1>Hol éri meg ma bevásárolnod?</h1><p className="lead">Válassz termékeket, jelöld ki a szóba jöhető boltokat, és a KosárRadar kiszámolja a teljes költséget az utazással együtt.</p></div>
        <div className="hero-card"><span>MAI CÉL</span><strong>Ne a termék legyen olcsóbb.</strong><p>Az egész bevásárlás legyen kedvezőbb.</p></div>
      </section>

      <section className="layout">
        <div className="panel">
          <div className="section-head"><div><span className="step">1</span><h2>Termékek kiválasztása</h2></div><span className="muted">{basket.length} tétel a kosárban</span></div>
          <div className="search-wrap">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Keresés: Perwoll, Somat, Cappy..." aria-label="Termék keresése" />
            <div className="product-list">
              {filteredProducts.map((product) => <button key={product.id} className="product-option" onClick={() => addProduct(product.id)}><div><strong>{product.name}</strong><span>{product.unit}</span></div><span className="add">+</span></button>)}
            </div>
          </div>

          <div className="basket">
            {basket.length === 0 ? <div className="empty">A kosár még üres.</div> : basket.map((item) => {
              const product = PRODUCTS.find((entry) => entry.id === item.productId);
              if (!product) return null;
              return <div className="basket-row" key={item.productId}><div><strong>{product.name}</strong><span>{product.unit}</span></div><div className="quantity"><button onClick={() => updateQuantity(item.productId, item.quantity - 1)}>−</button><span>{item.quantity}</span><button onClick={() => updateQuantity(item.productId, item.quantity + 1)}>+</button></div></div>;
            })}
          </div>

          <div className="section-head spacing"><div><span className="step">2</span><h2>Boltok kiválasztása</h2></div></div>
          <div className="store-grid">
            {STORES.map((store) => {
              const active = selectedStores.includes(store.id);
              return <button key={store.id} className={`store-card ${active ? "active" : ""}`} onClick={() => { setSelectedStores((current) => active ? current.filter((id) => id !== store.id) : [...current, store.id]); setCalculated(false); }}><span>{store.name}</span><small>{store.distanceKm} km</small></button>;
            })}
          </div>

          <div className="section-head spacing"><div><span className="step">3</span><h2>Utazási költség</h2></div></div>
          <div className="cost-row"><label>Költség kilométerenként<input type="number" min="0" value={costPerKm} onChange={(event) => { setCostPerKm(Number(event.target.value)); setCalculated(false); }} /></label><div className="hint">Elektromos autóhoz kiindulásnak 20–30 Ft/km használható.</div></div>
          <button className="calculate" onClick={() => setCalculated(true)}>Megéri?</button>
        </div>

        <aside className="panel results">
          <div className="section-head"><div><span className="step">4</span><h2>Eredmény</h2></div></div>
          {!calculated ? <div className="result-placeholder"><div className="radar">◎</div><strong>Készen állunk a számításra.</strong><p>Állítsd össze a kosarat, majd nyomd meg a „Megéri?” gombot.</p></div> : results.length === 0 ? <div className="result-placeholder"><strong>Nincs számítható eredmény.</strong><p>Válassz legalább egy boltot és egy terméket.</p></div> : <div className="ranking">
            {results.map((result, index) => {
              const storeNames = result.storeIds.map((id) => STORES.find((store) => store.id === id)?.name ?? id).join(" + ");
              const difference = result.total - results[0].total;
              return <article key={result.storeIds.join("-")} className={`result-card ${index === 0 ? "winner" : ""}`}><div className="rankline"><span>{index === 0 ? "Legjobb választás" : `${index + 1}. hely`}</span>{index === 0 && <span className="winner-badge">AJÁNLOTT</span>}</div><h3>{storeNames}</h3><dl><div><dt>Termékek</dt><dd>{money.format(result.productCost)}</dd></div><div><dt>Utazás</dt><dd>{money.format(result.travelCost)}</dd></div><div><dt>Összesen</dt><dd>{money.format(result.total)}</dd></div></dl>{index === 0 ? <div className="saving">A kiválasztott lehetőségek közül ez kerül a legkevesebbe.</div> : <div className="difference">+ {money.format(difference)} a legjobbhoz képest</div>}</article>;
            })}
          </div>}
        </aside>
      </section>

      <footer>A megjelenített árak tesztadatok. A prototípus a KosárRadar működési logikáját mutatja be.</footer>
    </main>
  );
}
