import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_TRAVEL,travelInput,tripCost,matrixInput,routePlans,recommend,mapsUrl,type RouteMatrix} from '../lib/travel.ts';
import {watchInput,observe,localWatches,type WatchConfig} from '../lib/price-watch.ts';
import {snapshotInput} from '../lib/saved-baskets.ts';
import type {Shop,BasketItem,Quote} from '../lib/types.ts';
import {sameOrigin} from '../lib/account-validation.ts';
const shops:Shop[]=['A','B','C'].map((id,i)=>({id,chainId:id,name:id,city:'Teszt',postalCode:'0000',address:'Teszt',latitude:47.5+i/100,longitude:19}));
const item=(code:string):BasketItem=>({code,name:code,qty:1,packaging:'1',unit:'l',returnFee:0,priceable:true,bulk:false,source:'gvh'});
const quote=(code:string,shopId:string,amount:number,extra:Partial<Quote>={}):Quote=>({code,shopId,prices:[{type:'NORMAL',amount}],returnFee:0,status:'ok',stale:false,observedAt:'2026-09-22T08:00:00Z',...extra});
const matrix=(distances:(number|null)[][]):RouteMatrix=>({shopIds:shops.slice(0,distances.length-1).map(s=>s.id),distances,durations:distances.map(row=>row.map(d=>d===null?null:d/10)),observedAt:'2026-09-22T08:00:00Z'});
const settings={...DEFAULT_TRAVEL,consumption:10,energyPrice:1000}; // 100 Ft/km
test('same-origin writes work behind the Next bind address but reject cross-site and forwarded-host spoofing',()=>{
 assert.equal(sameOrigin(new Request('http://0.0.0.0:3100/api/watches',{headers:{host:'localhost:3100',origin:'http://localhost:3100'}})),true);
 assert.equal(sameOrigin(new Request('https://app.example/api/watches',{headers:{host:'app.example',origin:'https://other.example','x-forwarded-host':'other.example'}})),false);
 assert.equal(sameOrigin(new Request('https://app.example/api/watches',{headers:{host:'app.example',origin:'http://app.example'}})),false);
});
test('the nearer store wins after including outbound AND return travel',()=>{
 const result=routePlans([item('x')],shops.slice(0,2),[quote('x','A',1000),quote('x','B',500)],[],matrix([[0,1000,5000],[1000,0,4000],[5000,4000,0]]),settings);
 assert.equal(result[0].id,'A');assert.equal(result[0].total,1200);assert.equal(result[1].total,1500);assert.equal(result[0].distanceKm,2);
});
test('splitting saves on goods but loses when detour costs more',()=>{
 const q=[quote('x','A',100),quote('y','A',600),quote('x','B',600),quote('y','B',100)];
 const result=routePlans([item('x'),item('y')],shops.slice(0,2),q,[],matrix([[0,1000,10000],[1000,0,9000],[10000,9000,0]]),settings);
 assert.equal(result[0].id,'A');assert.equal(result[0].total,900);assert.equal(result.find(p=>p.id==='A+B')!.total,2200);
});
test('route ordering uses directed distances and does not double a one-way distance',()=>{
 const q=[quote('x','A',100),quote('y','B',100)];
 const result=routePlans([item('x'),item('y')],shops.slice(0,2),q,[],matrix([[0,1000,9000],[9000,0,1000],[1000,9000,0]]),settings);
 assert.deepEqual(result[0].route,['A','B']);assert.equal(result[0].distanceKm,3);assert.equal(result[0].total,500);
});
test('three shops are considered only when user permits three stops',()=>{
 const m=matrix([[0,1000,1000,1000],[1000,0,1000,1000],[1000,1000,0,1000],[1000,1000,1000,0]]),q=[quote('x','A',100),quote('y','B',100),quote('z','C',100)],b=[item('x'),item('y'),item('z')];
 assert.equal(routePlans(b,shops,q,[],m,settings).length,0);
 const p=routePlans(b,shops,q,[],m,{...settings,maxStops:3})[0];assert.equal(p.lines.length,3);assert.equal(p.distanceKm,4);assert.equal(p.total,700);
});
test('unreachable legs, missing quotes, stale quotes, and a different product do not become free',()=>{
 const m=matrix([[0,1000],[null,0]]);assert.equal(routePlans([item('x')],shops.slice(0,1),[quote('x','A',100)],[],m,settings).length,0);
 for(const q of [quote('x','A',100,{stale:true}),quote('x','A',100,{status:'error'}),quote('other-size','A',1)])assert.equal(routePlans([item('x')],shops.slice(0,1),[q],[],matrix([[0,1000],[1000,0]]),settings).length,0);
});
test('quantity, deposit, energy, wear and parking are counted exactly once',()=>{
 const p=routePlans([{...item('x'),qty:2}],shops.slice(0,1),[quote('x','A',100,{returnFee:50})],[],matrix([[0,1000],[1000,0]]),{...settings,wearPerKm:10,parkingPerStop:300})[0];
 assert.equal(p.subtotal,200);assert.equal(p.deposits,100);assert.equal(p.energyCost,200);assert.equal(p.wearCost,20);assert.equal(p.parkingCost,300);assert.equal(p.total,820);
 assert.equal(tripCost(10,2,{...settings,vehicle:'electric',consumption:20,energyPrice:70}).energyCost,140);
 assert.equal(tripCost(10,2,{...settings,vehicle:'bicycle',parkingPerStop:500}).travel,0);
});
test('minimum savings preference may recommend one stop, with the cheaper alternative retained',()=>{
 const q=[quote('x','A',100),quote('y','A',600),quote('x','B',600),quote('y','B',100)];
 const plans=routePlans([item('x'),item('y')],shops.slice(0,2),q,[],matrix([[0,1000,1000],[1000,0,1000],[1000,1000,0]]),settings);
 assert.equal(plans[0].total,500);assert.equal(recommend(plans,500)?.shopIds.length,1);assert.equal(recommend(plans,0)?.shopIds.length,2);
});
test('travel settings round trip with saved basket; invalid values and bad matrices rejected',()=>{
 assert.equal(travelInput({...settings,energyPrice:NaN}),null);assert.equal(travelInput({...settings,maxStops:4}),null);
 assert.equal(matrixInput({distances:[[0]],durations:[[0]]},['A']),null);assert.equal(matrixInput({distances:[[0,-1],[1,0]],durations:[[0,1],[1,0]]},['A']),null);
 const saved=snapshotInput({name:'Heti',lines:[{id:'1',text:'tej'}],area:{place:null,radius:20},loyalty:[],extraStopCost:0,travel:settings});assert.deepEqual(saved?.travel,settings);
 const url=new URL(mapsUrl({latitude:47.5,longitude:19},['A','B'],shops,'bicycle')!);assert.equal(url.searchParams.get('origin'),url.searchParams.get('destination'));assert.equal(url.searchParams.get('travelmode'),'bicycling');assert.equal(url.searchParams.get('waypoints')!.split('|').length,2);
});
const config:WatchConfig={name:'Heti',items:[{code:'x',qty:2,name:'Pontosan x 1 l'}],shopIds:['A','B'],loyalty:[],direction:'all',threshold:0};
test('first observation seeds baseline; a later change yields exactly one event per store',()=>{
 const first=observe('watch',config,{},[quote('x','A',500),quote('x','B',600)],shops);assert.equal(first.events.length,0);
 const q=quote('x','A',400,{observedAt:'2026-09-23T08:00:00Z'}),second=observe('watch',config,first.prices,[q],shops);
 assert.equal(second.events.length,1);assert.equal(second.events[0].oldPrice,500);assert.equal(second.events[0].newPrice,400);assert.equal(second.prices['x:B'].amount,600);
 assert.equal(observe('watch',config,second.prices,[q],shops).events.length,0);
});
test('watch uses exact product and store; ignores stale, missing, error, older observations',()=>{
 const first=observe('w',config,{},[quote('x','A',500)],shops);
 for(const q of [quote('other','A',1),quote('x','C',1),quote('x','A',1,{stale:true}),quote('x','A',1,{status:'missing'}),quote('x','A',1,{status:'error'}),quote('x','A',1,{observedAt:'2026-09-21T08:00:00Z'})]){
  const next=observe('w',config,first.prices,[q],shops);assert.equal(next.events.length,0);assert.deepEqual(next.prices,first.prices);
 }
});
test('loyalty is opt-in and a deposit change affects payable pack price',()=>{
 const q=quote('x','A',500,{prices:[{type:'NORMAL',amount:500},{type:'LOYALTY',amount:300}],returnFee:50});
 const a=observe('w',config,{},[q],shops),b=observe('w',{...config,loyalty:['A']},{},[q],shops);assert.equal(a.prices['x:A'].amount,500);assert.equal(b.prices['x:A'].amount,300);
 const next=observe('w',config,a.prices,[{...q,returnFee:0,observedAt:'2026-09-23T08:00:00Z'}],shops);assert.equal(next.events[0].oldPrice,550);assert.equal(next.events[0].newPrice,500);
});
test('direction and threshold filter notifications, but baseline still advances',()=>{
 const first=observe('w',config,{},[quote('x','A',500)],shops),up=quote('x','A',600,{observedAt:'2026-09-23T08:00:00Z'});
 const downOnly=observe('w',{...config,direction:'down'},first.prices,[up],shops);assert.equal(downOnly.events.length,0);assert.equal(downOnly.prices['x:A'].amount,600);
 assert.equal(observe('w',{...config,threshold:101},first.prices,[up],shops).events.length,0);assert.equal(observe('w',{...config,threshold:100},first.prices,[up],shops).events.length,1);
});
test('watch configuration validates quantities, bounds, duplicates and local persistence',()=>{
 assert.deepEqual(watchInput(config),config);assert.equal(watchInput({...config,shopIds:['A','A']}),null);assert.equal(watchInput({...config,threshold:Infinity}),null);assert.equal(watchInput({...config,items:[{code:'x',name:'x',qty:0}]}),null);
 const state={watches:[{id:'w',config,prices:{},checkedAt:null}],notices:[]};assert.deepEqual(localWatches(JSON.stringify(state)),state);assert.throws(()=>localWatches('{oops'));
});
