import {eligiblePrice} from './optimizer.ts';
import type {Quote,Shop,PriceKind} from './types.ts';
export type WatchConfig={name:string;items:{code:string;qty:number;name:string}[];shopIds:string[];loyalty:string[];direction:'all'|'down'|'up';threshold:number};
export type PricePoint={amount:number;returnFee:number;kind:PriceKind;observedAt:string};
export type PriceChange={id:string;code:string;shopId:string;oldPrice:number;newPrice:number;oldKind:PriceKind;newKind:PriceKind;observedAt:string};
export type LocalWatch={id:string;config:WatchConfig;prices:Record<string,PricePoint>;checkedAt:string|null};
export type WatchNotice=PriceChange & {watchId:string;watchName:string;productName:string;read:boolean};
export const WATCH_KEY='kosarradar:price-watches:v1';
const id=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,64}$/.test(v);
export function watchInput(v:unknown):WatchConfig|null{
 if(!v||typeof v!=='object'||Array.isArray(v))return null;const d=v as WatchConfig;
 const ids=(v:unknown,max:number):v is string[]=>Array.isArray(v)&&v.length<=max&&v.every(id)&&new Set(v).size===v.length;
 if(typeof d.name!=='string'||!d.name.trim()||d.name.length>80||!Array.isArray(d.items)||!d.items.length||d.items.length>24||!ids(d.shopIds,8)||!d.shopIds.length||!ids(d.loyalty,20)||!['all','down','up'].includes(d.direction)||typeof d.threshold!=='number'||!Number.isFinite(d.threshold)||d.threshold<0||d.threshold>100000)return null;
 if(d.items.some(i=>!i||!id(i.code)||!Number.isInteger(i.qty)||i.qty<1||i.qty>99||typeof i.name!=='string'||!i.name.trim()||i.name.length>300)||new Set(d.items.map(i=>i.code)).size!==d.items.length)return null;
 return {name:d.name.trim(),items:d.items.map(i=>({code:i.code,qty:i.qty,name:i.name})),shopIds:[...d.shopIds],loyalty:[...d.loyalty],direction:d.direction,threshold:d.threshold};
}
/** Compare eligible unit prices including deposit. Never infer a price or alert from a failed observation. */
export function observe(watchId:string,config:WatchConfig,previous:Record<string,PricePoint>,quotes:Quote[],shops:Shop[]){
 const prices={...previous},events:PriceChange[]=[];
 for(const q of quotes){
  const shop=shops.find(s=>s.id===q.shopId);
  if(!shop||!config.shopIds.includes(q.shopId)||!config.items.some(i=>i.code===q.code)||q.status!=='ok'||q.stale||!Number.isFinite(Date.parse(q.observedAt))||!Number.isFinite(q.returnFee)||q.returnFee<0)continue;
  const p=eligiblePrice(q.prices,config.loyalty.includes(shop.chainId));if(!p)continue;
  const key=`${q.code}:${q.shopId}`,old=previous[key];
  if(old&&Date.parse(q.observedAt)<=Date.parse(old.observedAt))continue;
  prices[key]={amount:p.amount,returnFee:q.returnFee,kind:p.type,observedAt:q.observedAt};
  if(!old)continue;
  const oldPrice=Math.round((old.amount+old.returnFee)*100)/100,newPrice=Math.round((p.amount+q.returnFee)*100)/100,delta=Math.round((newPrice-oldPrice)*100)/100;
  if(!delta||Math.abs(delta)<config.threshold||(config.direction==='down'&&delta>0)||(config.direction==='up'&&delta<0))continue;
  events.push({id:`${watchId}:${key}:${q.observedAt}:${newPrice}`,code:q.code,shopId:q.shopId,oldPrice,newPrice,oldKind:old.kind,newKind:p.type,observedAt:q.observedAt});
 }
 return {prices,events};
}
export function localWatches(raw:string|null):{watches:LocalWatch[];notices:WatchNotice[]}{
 if(!raw)return {watches:[],notices:[]};const d=JSON.parse(raw);
 if(!d||!Array.isArray(d.watches)||d.watches.length>3||!Array.isArray(d.notices)||d.notices.length>100)throw Error('A helyi árfigyelések nem olvashatók.');
 const watches=d.watches.map((w:LocalWatch)=>{const config=watchInput(w?.config);if(!config||!id(w.id)||!w.prices||typeof w.prices!=='object'||Array.isArray(w.prices)||!(w.checkedAt===null||Number.isFinite(Date.parse(w.checkedAt))))throw Error('Sérült árfigyelés.');
  const prices:Record<string,PricePoint>={};for(const [key,p] of Object.entries(w.prices)){if(!p||!Number.isFinite(p.amount)||p.amount<=0||!Number.isFinite(p.returnFee)||p.returnFee<0||!['NORMAL','DISCOUNTED','LOYALTY'].includes(p.kind)||!Number.isFinite(Date.parse(p.observedAt)))throw Error('Sérült korábbi ár.');prices[key]=p;}
  return {id:w.id,config,prices,checkedAt:w.checkedAt};});
 const notices=d.notices.filter((n:WatchNotice)=>n&&typeof n.id==='string'&&typeof n.watchId==='string'&&typeof n.productName==='string'&&typeof n.watchName==='string'&&id(n.shopId)&&Number.isFinite(n.oldPrice)&&Number.isFinite(n.newPrice)&&Number.isFinite(Date.parse(n.observedAt))).map((n:WatchNotice)=>({...n,read:n.read===true}));
 return {watches,notices};
}
