import {travelInput,type TravelSettings} from './travel.ts';
import {restore} from './storage.ts';
import {selectedBasket,type ShoppingLine} from './shopping-text.ts';
import {validPlace,type Area} from './location.ts';
export type BasketSnapshot={name:string;lines:ShoppingLine[];area:Area;loyalty:string[];extraStopCost:number;travel?:TravelSettings};
export type SavedBasket={id:string;createdAt:string;snapshot:BasketSnapshot};
export const BASKETS_KEY='kosarradar:saved-baskets:v1';
export function snapshotInput(value:unknown):BasketSnapshot|null{
 try{
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const d=value as BasketSnapshot;
  if(typeof d.name!=='string'||!d.name.trim()||d.name.trim().length>80||!Array.isArray(d.lines)||!d.lines.length||d.lines.length>24)return null;
  if(!d.area||!(d.area.place===null||validPlace(d.area.place))||!Number.isInteger(d.area.radius)||d.area.radius<1||d.area.radius>100)return null;
  const travel=d.travel===undefined?undefined:travelInput(d.travel);if(travel===null)return null;
  const settings=restore(JSON.stringify({basket:[],shopIds:[],loyalty:d.loyalty,extraStopCost:d.extraStopCost}));if(!settings)return null;
  const lines=d.lines.map((l,i)=>{
   if(!l||typeof l.text!=='string'||!l.text.trim()||l.text.length>200)throw Error();
   const selected=l.selected&&restore(JSON.stringify({basket:[l.selected],shopIds:[],loyalty:[],extraStopCost:0}))?.basket[0];
   if(l.selected&&!selected)throw Error();
   // Strip arbitrary client fields and stale AI interpretations. Prices are always fetched anew.
   const product=selected?{code:selected.code,name:selected.name.slice(0,300),packaging:selected.packaging.slice(0,40),unit:selected.unit.slice(0,20),source:'gvh' as const,bulk:false,priceable:true,qty:selected.qty,returnFee:selected.returnFee}:undefined;
   return {id:String(i),text:l.text.trim(),...(product?{selected:product}:{})};
  });
  if(selectedBasket(lines).some(p=>p.qty>99))return null;
  return {name:d.name.trim(),lines,area:{place:d.area.place?{id:d.area.place.id,name:d.area.place.name,region:d.area.place.region,latitude:d.area.place.latitude,longitude:d.area.place.longitude}:null,radius:d.area.radius},loyalty:settings.loyalty,extraStopCost:settings.extraStopCost,...(travel?{travel}:{})};
 }catch{return null;}
}
export function savedBasketsInput(value:unknown):SavedBasket[]{
 if(!Array.isArray(value)||value.length>50)throw Error('Hibás kosármentés.');
 return value.map(v=>{const snapshot=snapshotInput(v?.snapshot);if(!snapshot||typeof v.id!=='string'||!/^[\w-]{1,64}$/.test(v.id)||typeof v.createdAt!=='string'||!Number.isFinite(Date.parse(v.createdAt)))throw Error('Hibás kosármentés.');return {id:v.id,createdAt:v.createdAt,snapshot};});
}
