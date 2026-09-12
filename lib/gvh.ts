import { allowedChain } from './retailers.ts';
import type { Chain, Observation, Price, Product, Shop } from './types.ts';
export class SourceError extends Error {
  code: string; status: number;
  constructor(code: string, message: string, status = 503) { super(message); this.code = code; this.status = status; }
}
type Cached = Observation & { value: unknown; expires: number; staleUntil: number };
const cache = new Map<string, Cached>();
const pending = new Map<string, Promise<Cached>>();
let active = 0;
const BASE = 'https://arfigyelo.gvh.hu/api';
/** Bounded process-local cache. A hit preserves the original observation timestamp. */
export async function source(path: string, ttl = 900_000): Promise<Cached> {
  if (process.env.GVH_ENABLED === 'false') throw new SourceError('disabled', 'Az árforrás átmenetileg ki van kapcsolva.');
  const prior = cache.get(path);
  if (prior && prior.expires > Date.now()) return { ...prior, stale: false };
  const inflight = pending.get(path); if (inflight) return inflight;
  const work = (async (): Promise<Cached> => {
    try {
      if (active >= 12) throw new SourceError('busy', 'Most sok lekérés fut. Próbáld újra rövidesen.');
      active++;
      try {
        const response = await fetch(BASE + path, { cache: 'no-store', signal: AbortSignal.timeout(15000), headers: { Accept: 'application/json', 'User-Agent': 'KosarRadar/0.6 (price comparison prototype)' } });
        if (!response.ok) throw new SourceError(response.status === 404 ? 'not_found' : 'upstream', 'Az árforrás most nem ad választ.', response.status === 404 ? 404 : 503);
        const body = await response.text();
        if (body.length > 6_000_000) throw new SourceError('invalid_response', 'Az árforrás válasza nem feldolgozható.');
        const value: unknown = JSON.parse(body);
        const result: Cached = { value, observedAt: new Date().toISOString(), stale: false, expires: Date.now() + ttl, staleUntil: Date.now() + ttl + 6 * 3600_000 };
        if (cache.size >= 600) cache.delete(cache.keys().next().value!);
        cache.delete(path); cache.set(path, result); return result;
      } finally { active--; }
    } catch (e) {
      if (prior && prior.staleUntil > Date.now() && !(e instanceof SourceError && e.code === 'not_found')) return { ...prior, stale: true };
      if (e instanceof SourceError) throw e;
      throw new SourceError('fetch_failed', 'Az árforrás nem érhető el. Próbáld újra később.');
    }
  })();
  pending.set(path, work);
  try { return await work; } finally { pending.delete(path); }
}
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SourceError('invalid_response', 'Az árforrás válasza megváltozott.');
  return value as Record<string, unknown>;
}
export function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new SourceError('invalid_response', 'Az árforrás válasza megváltozott.');
  return value;
}
function requiredText(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new SourceError('invalid_response', 'Hiányos termék- vagy üzletadat érkezett.');
  return value;
}
export const validId = (s: unknown): s is string => typeof s === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(s);
export function product(value: unknown): Product {
  const p = record(value), code = requiredText(p.id);
  if (!validId(code) || typeof p.bulk !== 'boolean' || typeof p.returnFee !== 'number' || !Number.isFinite(p.returnFee) || p.returnFee < 0 || typeof p.packaging !== 'string' || typeof p.unit !== 'string')
    throw new SourceError('invalid_response', 'Hiányos kiszerelés- vagy díjadat érkezett.');
  const imageUrl = typeof p.imageUrl === 'string' && p.imageUrl.startsWith('https://cdnarfigyeloprodweu.azureedge.net/') ? p.imageUrl : undefined;
  return { code, name: requiredText(p.name), packaging: p.packaging, unit: p.unit, bulk: p.bulk, returnFee: p.returnFee, imageUrl, priceable: !p.bulk, source: 'gvh' };
}
export function prices(value: unknown): Price[] {
  return array(value).flatMap(item => {
    const p = record(item);
    if (!['NORMAL', 'DISCOUNTED', 'LOYALTY'].includes(String(p.type)) || typeof p.amount !== 'number' || !Number.isFinite(p.amount) || p.amount <= 0) return [];
    return [{ type: p.type as Price['type'], amount: p.amount, unitAmount: typeof p.unitAmount === 'number' ? p.unitAmount : undefined }];
  });
}
export async function getShops(): Promise<Observation & { shops: Shop[]; chains: Chain[] }> {
  const [c, s] = await Promise.all([source('/chain-stores', 86400_000), source('/shops', 86400_000)]);
  const chains = array(record(c.value).chainStores).map(v => { const r = record(v); return { id: requiredText(r.uuid), name: requiredText(r.name) }; }).filter(c => allowedChain(c.id));
  const names = new Map(chains.map(v => [v.id, v.name]));
  const shops = array(record(s.value).shops).map(v => {
    const r = record(v), chainId = requiredText(r.chainStoreUuid);
    const loc = r.location && typeof r.location === 'object' ? record(r.location) : {};
    const located = typeof loc.latitude === 'number' && typeof loc.longitude === 'number' && Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude) && loc.latitude >= 45 && loc.latitude <= 49 && loc.longitude >= 16 && loc.longitude <= 23;
    return { id: requiredText(r.uuid), chainId, name: names.get(chainId) || 'Ismeretlen lánc', city: requiredText(r.city), postalCode: String(r.postalCode ?? ''), address: requiredText(r.address), ...(located ? { latitude: loc.latitude as number, longitude: loc.longitude as number } : {}) };
  });
  return { shops: shops.filter(s => allowedChain(s.chainId)), chains, stale: c.stale || s.stale, observedAt: [c.observedAt, s.observedAt].sort()[0] };
}
export function errorResponse(e: unknown): Response {
  const error = e instanceof SourceError ? e : new SourceError('internal', 'A kérés nem sikerült. Próbáld újra.');
  return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status, headers: { 'Cache-Control': 'no-store' } });
}
