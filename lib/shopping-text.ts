import type { BasketItem, Product } from './types.ts';

export type Need = { query: string; amount: number; unit: string; error?: string };
export type ShoppingLine = { id: string; text: string; selected?: BasketItem; interpretation?: string; aiNote?: string };
export const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/,/g, '.');
const units: Record<string, [string, number]> = { l: ['volume', 1000], liter: ['volume', 1000], litert: ['volume', 1000], ml: ['volume', 1], kg: ['weight', 1000], g: ['weight', 1], db: ['count', 1], darab: ['count', 1], csomag: ['count', 1] };
const quantity = /(?:^|\s)(-?\d+(?:[.,]\d+)?)\s*(liter|litert|ml|kg|csomag|darab|db|l|g)(?=\s|$)/i;

export function parseNeed(text: string): Need {
  const cleaned = text.replace(/(?<!\d),|,(?!\d)/g, ' ').trim();
  const m = cleaned.match(quantity);
  const amount = m ? Number(m[1].replace(',', '.')) : 1;
  const unit = m ? m[2].toLowerCase() : 'db';
  const query = (m ? cleaned.replace(m[0], ' ') : cleaned).replace(/\s+/g, ' ').trim();
  const error = !query ? 'Írd be a termék nevét.' : query.length > 100 ? 'Legfeljebb 100 karakteres terméknevet írj.' : amount <= 0 || amount > 100000 ? 'Adj meg pozitív, ésszerű mennyiséget.' : units[unit][0] === 'count' && !Number.isInteger(amount) ? 'Egész darabszámot adj meg.' : undefined;
  return { query, amount, unit, error };
}

export function splitList(text: string): string[] {
  const lines: string[] = [];
  for (const row of text.split(/[\n;]+/)) {
    const parts = row.split(/(?<!\d),|,(?!\d)/).map(s => s.trim()).filter(Boolean);
    for (const part of parts) {
      if (/^\d+(?:[.,]\d+)?\s*(?:liter|litert|ml|kg|csomag|darab|db|l|g)$/i.test(part) && lines.length && parts.indexOf(part) > 0) lines[lines.length - 1] += ', ' + part;
      else lines.push(part);
    }
  }
  return lines;
}

export function tokens(text: string): string[] {
  const synonyms: Record<string, string> = { almale: 'alma', almalet: 'alma', tejet: 'tej' };
  return normalize(text).replace(/[^a-z0-9.%]+/g, ' ').trim().split(/\s+/).filter(Boolean).map(t => synonyms[t] || t);
}
export function matchesNeed(name: string, query: string) {
  const words = tokens(name);
  return tokens(query).every(t => words.includes(t));
}

export function packageChoice(need: Need, p: Product): { qty: number; label: string; error?: string } {
  const fail = (error: string) => ({ qty: 0, label: '', error });
  if (need.error) return fail(need.error);
  if (!p.priceable || p.bulk) return fail('Kimért termékkel még nem számolunk.');
  let qty = need.amount;
  let label = `${qty} csomag`;
  const target = units[need.unit];
  if (target[0] !== 'count') {
    const size = Number(p.packaging.replace(',', '.')), packUnit = units[normalize(p.unit)];
    if (!packUnit || packUnit[0] !== target[0] || !Number.isFinite(size) || size <= 0) return fail('Ehhez a kiszereléshez adj meg darabszámot a listában.');
    const exact = need.amount * target[1] / (size * packUnit[1]);
    qty = Math.ceil(exact - 1e-9);
    const total = (qty * size).toLocaleString('hu-HU', { maximumFractionDigits: 3 });
    label = `${qty} × ${p.packaging.replace('.', ',')} ${p.unit} = ${total} ${p.unit}${Math.abs(qty - exact) > 1e-8 ? ' · egész csomagra kerekítve' : ''}`;
  }
  if (!Number.isInteger(qty) || qty < 1 || qty > 99) return fail('Legfeljebb 99 csomag választható termékenként.');
  return { qty, label };
}

export function selectedBasket(lines: ShoppingLine[]): BasketItem[] {
  const map = new Map<string, BasketItem>();
  for (const line of lines) if (line.selected) {
    const p = line.selected, prior = map.get(p.code);
    map.set(p.code, { ...p, qty: (prior?.qty || 0) + p.qty });
  }
  return [...map.values()];
}
