import { array, getShops, prices, product, record, source, SourceError, validId } from './gvh.ts';
import { optimize } from './optimizer.ts';
import type { BasketItem, Comparison, Product, Quote } from './types.ts';
export async function compare(input: unknown): Promise<Comparison> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new SourceError('invalid_input', 'Hibás kosáradat.', 400);
  const body = record(input);
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 24 || !Array.isArray(body.shopIds) || !body.shopIds.length || body.shopIds.length > 8 || !Array.isArray(body.loyaltyChainIds) || body.loyaltyChainIds.length > 20) throw new SourceError('invalid_input', 'Válassz 1–24 terméket és 1–8 üzletet.', 400);
  const items = body.items.map(v => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new SourceError('invalid_input', 'Hibás kosártétel.', 400);
    const r = record(v);
    if (!validId(r.code) || !Number.isInteger(r.qty) || Number(r.qty) < 1 || Number(r.qty) > 99) throw new SourceError('invalid_input', 'Hibás termék vagy darabszám (1–99).', 400);
    return { code: r.code, qty: Number(r.qty) };
  });
  if (new Set(items.map(v => v.code)).size !== items.length || body.shopIds.some(v => !validId(v)) || new Set(body.shopIds).size !== body.shopIds.length || body.loyaltyChainIds.some(v => !validId(v)) || typeof body.extraStopCost !== 'number' || !Number.isFinite(body.extraStopCost) || body.extraStopCost < 0 || body.extraStopCost > 100000) throw new SourceError('invalid_input', 'Ellenőrizd az üzleteket és a második megálló költségét.', 400);
  const catalogue = await getShops();
  const shops = catalogue.shops.filter(s => (body.shopIds as string[]).includes(s.id));
  if (shops.length !== body.shopIds.length || body.loyaltyChainIds.some(id => !catalogue.chains.some(c => c.id === id))) throw new SourceError('invalid_input', 'Ismeretlen üzlet vagy lánc.', 400);
  const collected: { product: Product; quotes: Quote[]; qty: number }[] = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(4, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      let p: Product = { code: item.code, name: item.code, packaging: '', unit: '', bulk: false, returnFee: 0, source: 'gvh', priceable: false };
      try {
        const [detail, shopData] = await Promise.all([source('/product/' + item.code), source('/product/' + item.code + '/shop/' + shops.map(s => s.id).join(','))]);
        p = product(detail.value);
        if (p.code !== item.code) throw new SourceError('invalid_response', 'Eltérő termékazonosító érkezett.');
        const rows = array(record(shopData.value).shops).map(record);
        if (rows.some(r => r.uuid !== item.code || !shops.some(s => s.id === r.shopUuid))) throw new SourceError('invalid_response', 'Eltérő termékhez vagy üzlethez tartozó ár érkezett.');
        const stale = detail.stale || shopData.stale, observedAt = [detail.observedAt, shopData.observedAt].sort()[0];
        const quotes: Quote[] = shops.map(s => {
          const row = rows.find(r => r.shopUuid === s.id), found = row ? prices(row.prices) : [];
          return { code: item.code, shopId: s.id, prices: found, returnFee: p.returnFee, observedAt, stale, status: p.bulk ? 'unsupported' : stale ? 'stale' : found.length ? 'ok' : 'missing' };
        });
        collected.push({ product: p, qty: item.qty, quotes });
      } catch (e) {
        p = { ...p, code: item.code };
        const reason = e instanceof SourceError ? e.code : 'fetch_failed';
        collected.push({ product: p, qty: item.qty, quotes: shops.map(s => ({ code: item.code, shopId: s.id, prices: [], returnFee: 0, observedAt: '', stale: false, status: reason === 'not_found' ? 'missing' : 'error', reason })) });
      }
    }
  }));
  const basket: BasketItem[] = items.map(item => { const r = collected.find(v => v.product.code === item.code)!; return { ...r.product, qty: item.qty }; });
  const quotes = collected.flatMap(v => v.quotes), warnings: string[] = [];
  if (quotes.some(q => q.status === 'error')) warnings.push('Néhány ár lekérése sikertelen. Ezeket nem számoltuk bele.');
  if (quotes.some(q => q.stale)) warnings.push('Korábbi áradat érkezett; ebből most nem ajánlunk teljes kosarat.');
  if (catalogue.stale) warnings.push('Az üzletlista korábban lekért adatokból származik.');
  return { quotes, products: basket, plans: optimize(basket, shops, quotes, body.loyaltyChainIds as string[], body.extraStopCost), comparedAt: new Date().toISOString(), oldestObservation: quotes.map(q => q.observedAt).filter(Boolean).sort()[0] || null, warnings };
}
