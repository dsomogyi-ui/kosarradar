"use client";

import { useEffect, useMemo, useState } from "react";

type LivePrice = {
  id: string;
  store: string;
  product: string;
  url: string;
  price: number | null;
  currency: "HUF";
  checkedAt: string;
  status: "ok" | "unavailable" | "error";
  note: string;
};

type ApiResponse = {
  productGroup: string;
  results: LivePrice[];
  disclaimer: string;
};

const money = new Intl.NumberFormat("hu-HU", {
  style: "currency",
  currency: "HUF",
  maximumFractionDigits: 0
});

export default function Home() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  async function loadPrices() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/perwoll?t=${Date.now()}`, {
        cache: "no-store"
      });
      if (!response.ok) throw new Error(`Szerverhiba: ${response.status}`);
      const payload = (await response.json()) as ApiResponse;
      setData(payload);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nem sikerült lekérni az árakat.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPrices();
  }, []);

  const available = useMemo(
    () =>
      (data?.results ?? [])
        .filter((item) => item.price !== null)
        .sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity)),
    [data]
  );

  const best = available[0] ?? null;

  return (
    <main>
      <header className="topbar">
        <div className="brand">
          <div className="logo">KR</div>
          <div>
            <strong>KosárRadar</strong>
            <span>Élő árteszt • Perwoll</span>
          </div>
        </div>
        <div className="pill">Live Alpha 0.2</div>
      </header>

      <section className="hero live-hero">
        <div>
          <p className="eyebrow">ÉLŐ ONLINE ÁRLEKÉRDEZÉS</p>
          <h1>Hol a legolcsóbb most a Perwoll?</h1>
          <p className="lead">
            A KosárRadar közvetlenül a támogatott üzletek online termékoldalait
            ellenőrzi, és egységes listában mutatja az eredményt.
          </p>
          <div className="actions">
            <button className="calculate inline-button" onClick={() => void loadPrices()} disabled={loading}>
              {loading ? "Árak lekérése…" : "Árak frissítése"}
            </button>
            {lastRefresh && (
              <span className="last-refresh">
                Utolsó frissítés: {lastRefresh.toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        </div>
        <div className="hero-card">
          <span>TESZTTERMÉK</span>
          <strong>Perwoll Color</strong>
          <p>Az eltérő kiszereléseket külön feltüntetjük, hogy az összehasonlítás ne legyen félrevezető.</p>
        </div>
      </section>

      {error && <div className="error-box">{error}</div>}

      <section className="live-layout">
        <div className="panel">
          <div className="section-head">
            <div>
              <span className="step">1</span>
              <h2>Aktuális online árak</h2>
            </div>
          </div>

          {loading && !data ? (
            <div className="result-placeholder">
              <div className="radar radar-spin">◎</div>
              <strong>Árak ellenőrzése folyamatban…</strong>
              <p>Az első lekérés néhány másodpercig tarthat.</p>
            </div>
          ) : (
            <div className="live-price-list">
              {(data?.results ?? []).map((item) => {
                const isBest = best?.id === item.id;
                return (
                  <article className={`live-price-card ${isBest ? "winner" : ""}`} key={item.id}>
                    <div className="price-main">
                      <div>
                        <div className="store-title">
                          <h3>{item.store}</h3>
                          {isBest && <span className="winner-badge">LEGOLCSÓBB</span>}
                        </div>
                        <p>{item.product}</p>
                      </div>
                      <div className="price-value">
                        {item.price !== null ? money.format(item.price) : "Nem elérhető"}
                      </div>
                    </div>
                    <div className="source-row">
                      <span className={`status ${item.status}`}>{item.note}</span>
                      <a href={item.url} target="_blank" rel="noreferrer">Termékoldal ↗</a>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <aside className="panel results">
          <div className="section-head">
            <div>
              <span className="step">2</span>
              <h2>KosárRadar ajánlás</h2>
            </div>
          </div>

          {best ? (
            <div className="recommendation">
              <span className="recommend-label">JELENLEGI LEGJOBB ONLINE ÁR</span>
              <h2>{best.store}</h2>
              <div className="recommend-price">{money.format(best.price ?? 0)}</div>
              <p>{best.product}</p>
              {available.length > 1 && (
                <div className="saving">
                  {money.format((available[1].price ?? 0) - (best.price ?? 0))} előny a következő elérhető ajánlathoz képest.
                </div>
              )}
              <a className="visit-link" href={best.url} target="_blank" rel="noreferrer">
                Megnézem az üzletnél
              </a>
            </div>
          ) : (
            <div className="result-placeholder">
              <strong>Még nincs értékelhető ár.</strong>
              <p>Próbáld meg újra az árfrissítést.</p>
            </div>
          )}

          <div className="notice">
            <strong>Fontos</strong>
            <p>{data?.disclaimer ?? "Az online és a fizikai bolti ár eltérhet."}</p>
          </div>
        </aside>
      </section>

      <footer>
        KosárRadar Live Alpha • A lekérés 30 percig gyorsítótárazható • Forrásoldalak változása esetén a felismerőt frissíteni kell
      </footer>
    </main>
  );
}
