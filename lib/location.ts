import type { Shop } from './types.ts';
export type Place = { id: number; name: string; region: string; latitude: number; longitude: number };
export type Area = { place: Place | null; radius: number };
export function validPlace(v: unknown): v is Place {
  if (!v || typeof v !== 'object') return false;
  const p = v as Place;
  return Number.isInteger(p.id) && p.id > 0 && typeof p.name === 'string' && p.name.length > 0 && p.name.length <= 100 && typeof p.region === 'string' && p.region.length <= 150 && Number.isFinite(p.latitude) && p.latitude >= 45 && p.latitude <= 49 && Number.isFinite(p.longitude) && p.longitude >= 16 && p.longitude <= 23;
}
export function distanceKm(a: {latitude:number;longitude:number}, b: {latitude:number;longitude:number}) {
  const rad = (n:number) => n*Math.PI/180;
  const x = Math.sin(rad(b.latitude-a.latitude)/2)**2 + Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(rad(b.longitude-a.longitude)/2)**2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(Math.min(1,x)),Math.sqrt(Math.max(0,1-x)));
}
export function nearbyShops(shops: Shop[], area: Area) {
  if (!area.place) return [];
  const p = area.place;
  return shops.flatMap(s => typeof s.latitude === 'number' && typeof s.longitude === 'number' ? [{...s,distance:distanceKm(p,{latitude:s.latitude,longitude:s.longitude})}] : [])
    .filter(s => s.distance <= area.radius).sort((a,b)=>a.distance-b.distance || a.id.localeCompare(b.id));
}
