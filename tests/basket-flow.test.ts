import test from 'node:test';
import assert from 'node:assert/strict';
import {distanceKm,nearbyShops,type Area} from '../lib/location.ts';
import {snapshotInput,savedBasketsInput} from '../lib/saved-baskets.ts';
import {reviewInput,reviewOutput} from '../lib/ai-review.ts';
const area:Area={place:{id:716968,name:'Nyékládháza',region:'Borsod',latitude:47.98333,longitude:20.83333},radius:20};
test('radius includes nearby stores across city boundaries and excludes unknown coordinates',()=>{
 const shop={id:'tesco-1',chainId:'tesco',name:'Tesco',city:'Miskolc',postalCode:'3508',address:'Teszt utca',latitude:48.05,longitude:20.79};
 const stores=nearbyShops([shop,{...shop,id:'far',latitude:47.5,longitude:19},{...shop,id:'unknown',latitude:undefined}],area);
 assert.deepEqual(stores.map(s=>s.id),['tesco-1']);assert.ok(stores[0].distance>7&&stores[0].distance<9);
 assert.equal(distanceKm(area.place!,area.place!),0);assert.equal(nearbyShops([shop],{...area,radius:5}).length,0);
});
test('named snapshots preserve unresolved lines and settings but never old prices or arbitrary AI state',()=>{
 const snapshot={name:' Heti kosár ',lines:[{id:'x',text:'Cappy almalé, 2 liter',interpretation:'wrong',aiNote:'wrong'},{id:'y',text:'tej'}],area,loyalty:[],extraStopCost:500};
 const saved=snapshotInput(snapshot)!;assert.equal(saved.name,'Heti kosár');assert.equal(saved.lines.length,2);assert.equal(saved.lines[0].selected,undefined);assert.equal(saved.lines[0].interpretation,undefined);assert.deepEqual(saved.area,area);
 const entry={id:'saved-1',snapshot:saved,createdAt:new Date().toISOString()};assert.equal(savedBasketsInput([entry])[0].snapshot.lines[0].text,'Cappy almalé, 2 liter');
 assert.equal(snapshotInput({...snapshot,area:{...area,radius:NaN}}),null);assert.equal(snapshotInput({...snapshot,lines:[{text:'tej',selected:{code:'invented'}}]}),null);
});
test('AI validation rejects changed row counts, bad quantities and unsupported units',()=>{
 assert.deepEqual(reviewInput({lines:['Cappy almalet']}),['Cappy almalet']);assert.equal(reviewInput({lines:[]}),null);
 assert.deepEqual(reviewOutput({lines:[{query:'Cappy alma',amount:2,unit:'l',note:''}]},1),[{interpretation:'Cappy alma, 2 l',note:''}]);
 assert.equal(reviewOutput({lines:[]},1),null);assert.equal(reviewOutput({lines:[{query:'tej',amount:-1,unit:'l',note:''}]},1),null);
 assert.equal(reviewOutput({lines:[{query:'tej',amount:1,unit:'bucket',note:''}]},1),null);
});
