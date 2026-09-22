import {eligiblePrice} from './optimizer.ts';
import type {BasketItem, Plan, Quote, Shop} from './types.ts';

export type Vehicle = 'petrol' | 'diesel' | 'hybrid' | 'electric' | 'bicycle' | 'walking';
export type TravelSettings = {vehicle:Vehicle;consumption:number;energyPrice:number;wearPerKm:number;parkingPerStop:number;maxStops:number;minimumSaving:number};
export const DEFAULT_TRAVEL:TravelSettings={vehicle:'petrol',consumption:7,energyPrice:650,wearPerKm:0,parkingPerStop:0,maxStops:2,minimumSaving:0};
export type Point={latitude:number;longitude:number};
export type RouteMatrix={shopIds:string[];distances:(number|null)[][];durations:(number|null)[][];observedAt:string};
export type TravelPlan=Plan & {route:string[];distanceKm:number;minutes:number;energyCost:number;wearCost:number;parkingCost:number};
export const money=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
export function travelInput(v:unknown):TravelSettings|null{
 if(!v||typeof v!=='object')return null;const s=v as TravelSettings;
 if(!['petrol','diesel','hybrid','electric','bicycle','walking'].includes(s.vehicle))return null;
 if(!['consumption','energyPrice','wearPerKm','parkingPerStop','minimumSaving'].every(k=>typeof s[k as keyof TravelSettings]==='number'&&Number.isFinite(s[k as keyof TravelSettings])&&Number(s[k as keyof TravelSettings])>=0))return null;
 if(s.consumption>100||s.energyPrice>10000||s.wearPerKm>10000||s.parkingPerStop>100000||s.minimumSaving>100000||![1,2,3].includes(s.maxStops))return null;
 return {vehicle:s.vehicle,consumption:s.consumption,energyPrice:s.energyPrice,wearPerKm:s.wearPerKm,parkingPerStop:s.parkingPerStop,maxStops:s.maxStops,minimumSaving:s.minimumSaving};
}
export function validPoint(v:unknown):v is Point{if(!v||typeof v!=='object')return false;const p=v as Point;return Number.isFinite(p.latitude)&&p.latitude>=45&&p.latitude<=49&&Number.isFinite(p.longitude)&&p.longitude>=16&&p.longitude<=23;}
export function tripCost(km:number,stops:number,s:TravelSettings){
 const powered=!['walking','bicycle'].includes(s.vehicle);
 const energyCost=powered?money(km*s.consumption*s.energyPrice/100):0;
 const wearCost=money(km*s.wearPerKm),parkingCost=powered?money(stops*s.parkingPerStop):0;
 return {energyCost,wearCost,parkingCost,travel:money(energyCost+wearCost+parkingCost)};
}
export function matrixInput(v:unknown,shopIds:string[]):RouteMatrix|null{
 if(!v||typeof v!=='object')return null;const r=v as RouteMatrix,n=shopIds.length+1;
 const ok=(m:unknown):m is (number|null)[][]=>Array.isArray(m)&&m.length===n&&m.every(row=>Array.isArray(row)&&row.length===n&&row.every(x=>x===null||(typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=100000000)));
 if(!ok(r.distances)||!ok(r.durations))return null;
 return {shopIds:[...shopIds],distances:r.distances,durations:r.durations,observedAt:new Date().toISOString()};
}
function permutations<T>(items:T[]):T[][]{return items.length<=1?[items]:items.flatMap((v,i)=>permutations(items.filter((_,j)=>j!==i)).map(rest=>[v,...rest]));}
/** Enumerates every 1–3 store subset (up to 8 selected stores) and both directions of each round trip. */
export function routePlans(basket:BasketItem[],shops:Shop[],quotes:Quote[],loyalty:string[],matrix:RouteMatrix,settings:TravelSettings):TravelPlan[]{
 if(!basket.length||!shops.length||shops.length>8||!travelInput(settings))return [];
 const groups:Shop[][]=[];
 function subsets(start:number,chosen:Shop[]){if(chosen.length)groups.push(chosen);if(chosen.length===settings.maxStops)return;for(let i=start;i<shops.length;i++)subsets(i+1,[...chosen,shops[i]]);}
 subsets(0,[]);const lookup=new Map(quotes.map(q=>[`${q.code}:${q.shopId}`,q]));const results=new Map<string,TravelPlan>();
 for(const group of groups){
  const lines:Plan['lines']=[];
  for(const item of basket){
   const candidates=group.flatMap(shop=>{const q=lookup.get(`${item.code}:${shop.id}`);if(!q||q.status!=='ok'||q.stale)return [];const p=eligiblePrice(q.prices,loyalty.includes(shop.chainId));return p?[{code:item.code,name:item.name,qty:item.qty,shopId:shop.id,unitPrice:p.amount,returnFee:q.returnFee,total:money((p.amount+q.returnFee)*item.qty),priceKind:p.type}]:[];});
   candidates.sort((a,b)=>a.total-b.total||a.shopId.localeCompare(b.shopId));if(candidates[0])lines.push(candidates[0]);
  }
  if(lines.length!==basket.length)continue;
  // A subset with unused stores is already covered by a smaller subset. No extra stop is charged.
  const used=[...new Set(lines.map(l=>l.shopId))].sort(),id=used.join('+');if(results.has(id))continue;
  let best:{route:string[];distanceKm:number;minutes:number;travel:number;energyCost:number;wearCost:number;parkingCost:number}|null=null;
  for(const route of permutations(used)){
   const indices=route.map(id=>matrix.shopIds.indexOf(id)+1);if(indices.some(i=>i===0))continue;
   const path=[0,...indices,0];let meters=0,seconds=0,reachable=true;
   for(let i=1;i<path.length;i++){const d=matrix.distances[path[i-1]]?.[path[i]],t=matrix.durations[path[i-1]]?.[path[i]];if(d===null||d===undefined||t===null||t===undefined){reachable=false;break;}meters+=d;seconds+=t;}
   if(!reachable)continue;const cost=tripCost(meters/1000,used.length,settings);
   const candidate={route,distanceKm:meters/1000,minutes:seconds/60,...cost};
   if(!best||candidate.travel<best.travel||(candidate.travel===best.travel&&candidate.minutes<best.minutes))best=candidate;
  }
  if(!best)continue;
  const subtotal=money(lines.reduce((s,l)=>s+l.unitPrice*l.qty,0)),deposits=money(lines.reduce((s,l)=>s+l.returnFee*l.qty,0));
  results.set(id,{id,shopIds:used,lines,missingCodes:[],complete:true,subtotal,deposits,...best,total:money(subtotal+deposits+best.travel)});
 }
 return [...results.values()].sort((a,b)=>a.total-b.total||a.shopIds.length-b.shopIds.length||a.minutes-b.minutes||a.id.localeCompare(b.id));
}
export function recommend(plans:TravelPlan[],minimumSaving:number){const cheapest=plans[0];if(!cheapest)return null;const single=plans.find(p=>p.shopIds.length===1);return single&&single.total-cheapest.total<minimumSaving?single:cheapest;}
export function mapsUrl(origin:Point,route:string[],shops:Shop[],vehicle:Vehicle){
 const points=route.map(id=>shops.find(s=>s.id===id));if(points.some(s=>!validPoint(s)))return null;
 const start=`${origin.latitude},${origin.longitude}`,p=new URLSearchParams({api:'1',origin:start,destination:start,travelmode:vehicle==='walking'?'walking':vehicle==='bicycle'?'bicycling':'driving',waypoints:points.map(s=>`${s!.latitude},${s!.longitude}`).join('|')});
 return `https://www.google.com/maps/dir/?${p}`;
}
