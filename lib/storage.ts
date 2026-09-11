import type { BasketItem } from './types.ts';
export const STORAGE_KEY = 'kosarradar:v0.5';
export type SavedState = { basket: BasketItem[]; shopIds: string[]; loyalty: string[]; extraStopCost: number };
export function restore(raw: string | null): SavedState | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw);
    const ids = (v: unknown): v is string[] => Array.isArray(v) && v.every(s => typeof s === 'string' && /^[\w-]{1,64}$/.test(s));
    if (!d || !Array.isArray(d.basket) || d.basket.length > 24 || !ids(d.shopIds) || d.shopIds.length > 8 || !ids(d.loyalty) || d.loyalty.length > 20 || !Number.isFinite(d.extraStopCost) || d.extraStopCost < 0 || d.extraStopCost > 100000) return null;
    if (!d.basket.every((p: BasketItem) => p && typeof p.code === 'string' && /^[\w-]{1,64}$/.test(p.code) && typeof p.name === 'string' && typeof p.packaging === 'string' && typeof p.unit === 'string' && p.source === 'gvh' && p.bulk === false && p.priceable === true && Number.isInteger(p.qty) && p.qty > 0 && p.qty <= 99 && Number.isFinite(p.returnFee) && p.returnFee >= 0)) return null;
    if (new Set(d.basket.map((p: BasketItem) => p.code)).size !== d.basket.length || new Set(d.shopIds).size !== d.shopIds.length) return null;
    return { basket: d.basket, shopIds: d.shopIds, loyalty: d.loyalty, extraStopCost: d.extraStopCost };
  } catch { return null; }
}
