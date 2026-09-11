import type { BasketItem, Plan, Price, Quote, Shop } from './types.ts';
const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export function eligiblePrice(prices: Price[], loyalty: boolean): Price | undefined {
  return prices.filter(p => Number.isFinite(p.amount) && p.amount > 0 && (p.type === 'NORMAL' || p.type === 'DISCOUNTED' || (loyalty && p.type === 'LOYALTY')))
    .sort((a, b) => a.amount - b.amount || Number(a.type === 'LOYALTY') - Number(b.type === 'LOYALTY'))[0];
}
/** Missing and stale prices never become zero-price items. */
export function optimize(basket: BasketItem[], shops: Shop[], quotes: Quote[], loyaltyChainIds: string[], extraStopCost: number): Plan[] {
  if (!basket.length || !shops.length) return [];
  const groups = shops.map(s => [s]);
  for (let i = 0; i < shops.length; i++) for (let j = i + 1; j < shops.length; j++) groups.push([shops[i], shops[j]]);
  const lookup = new Map(quotes.map(q => [`${q.code}:${q.shopId}`, q]));
  const unique = new Map<string, Plan>();
  for (const group of groups) {
    const lines: Plan['lines'] = [], missingCodes: string[] = [];
    for (const item of basket) {
      const options = group.flatMap(shop => {
        const quote = lookup.get(`${item.code}:${shop.id}`);
        if (!quote || quote.status !== 'ok' || quote.stale) return [];
        const price = eligiblePrice(quote.prices, loyaltyChainIds.includes(shop.chainId));
        return price ? [{ code: item.code, name: item.name, qty: item.qty, shopId: shop.id, unitPrice: price.amount, returnFee: quote.returnFee,
          total: money((price.amount + quote.returnFee) * item.qty), priceKind: price.type }] : [];
      }).sort((a, b) => a.total - b.total || a.shopId.localeCompare(b.shopId));
      if (options[0]) lines.push(options[0]); else missingCodes.push(item.code);
    }
    const used = [...new Set(lines.map(l => l.shopId))].sort();
    const shopIds = used.length ? used : group.map(s => s.id).sort();
    const subtotal = money(lines.reduce((s, l) => s + l.unitPrice * l.qty, 0));
    const deposits = money(lines.reduce((s, l) => s + l.returnFee * l.qty, 0));
    const travel = used.length > 1 ? Math.max(0, extraStopCost) : 0;
    const plan: Plan = { id: shopIds.join('+'), shopIds, lines, missingCodes, complete: missingCodes.length === 0,
      subtotal, deposits, travel, total: money(subtotal + deposits + travel) };
    const key = plan.id + ':' + missingCodes.join(',');
    if (!unique.has(key) || unique.get(key)!.total > plan.total) unique.set(key, plan);
  }
  return [...unique.values()].sort((a, b) => Number(b.complete) - Number(a.complete) || a.missingCodes.length - b.missingCodes.length || a.total - b.total || a.shopIds.length - b.shopIds.length);
}
