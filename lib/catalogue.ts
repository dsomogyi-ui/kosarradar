import { array, record, product, source, SourceError } from './gvh.ts';
import { allowedChain } from './retailers.ts';
export type Category = { id:number; name:string; children:Category[] };
export function categories(value:unknown, depth=0):Category[] {
 if(depth>4) throw new SourceError('invalid_response','Hibás kategóriafa.');
 return array(value).map(v=>{ const r=record(v);
  if(!Number.isInteger(r.id)||Number(r.id)<1||typeof r.name!=='string'||!r.name.trim()) throw new SourceError('invalid_response','Hiányos kategóriaadat.');
  return {id:Number(r.id),name:r.name,children:categories(r.categoryNodes,depth+1)};
 });
}
export async function getCategories(){const d=await source('/categories',86400000);return {categories:categories(record(d.value).categories),stale:d.stale,observedAt:d.observedAt};}
export function isLeaf(nodes:Category[],id:number):boolean{return nodes.some(n=>n.id===id?!n.children.length:isLeaf(n.children,id));}
export function supportedProduct(value:unknown){
 const r=record(value), stores=r.pricesOfChainStores ?? r.chainStores;
 return array(stores).some(v=>{const c=record(v);return allowedChain(c.id ?? c.uuid);});
}
export async function cataloguePage(path:string,offset:number){
 const d=await source(path,3600000), body=record(d.value), rows=array(body.products);
 if(typeof body.count!=='number'||!Number.isInteger(body.count)||body.count<0)throw new SourceError('invalid_response','Hiányos találati lista.');
 return {products:rows.filter(supportedProduct).map(product),hasMore:offset+rows.length<body.count&&rows.length>0&&offset<1000,stale:d.stale,observedAt:d.observedAt};
}
