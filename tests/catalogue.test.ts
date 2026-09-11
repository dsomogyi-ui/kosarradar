import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {categories,isLeaf,supportedProduct,cataloguePage} from '../lib/catalogue.ts';
import {accountInput,sameOrigin} from '../lib/account-validation.ts';
import {RETAILERS} from '../lib/retailers.ts';
import {GET as category} from '../app/api/products/category/route.ts';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/product.json',import.meta.url),'utf8'));
test('nested categories preserve leaf identity and reject malformed trees',()=>{
 const tree=categories([{id:1001,name:'Italok',categoryNodes:[{id:62,name:'Almalé',categoryNodes:[]}]}]);
 assert.equal(isLeaf(tree,62),true);assert.equal(isLeaf(tree,1001),false);assert.equal(isLeaf(tree,999),false);
 assert.throws(()=>categories([{id:62,name:'Almalé'}]));
});
test('catalogue excludes other chains without misrepresenting pagination',async()=>{
 const allowed={...fixture,pricesOfChainStores:[{id:RETAILERS[0].id}]};
 const excluded={...fixture,id:'spar-only',pricesOfChainStores:[{id:'excluded'}]};
 assert.equal(supportedProduct(allowed),true);assert.equal(supportedProduct(excluded),false);
 const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({products:[excluded,allowed],count:30});
 try{const page=await cataloguePage('/four-chain-test',0);assert.equal(page.products.length,1);assert.equal(page.products[0].code,fixture.id);assert.equal(page.hasMore,true);}finally{globalThis.fetch=original;}
});
test('category endpoint rejects invalid inputs before contacting source',async()=>{
 for(const query of ['id=0','id=abc','id=62&offset=-1','id=62&offset=1001'])assert.equal((await category(new Request('https://test.local/api/products/category?'+query))).status,400);
});
test('account write boundary rejects oversized, duplicate and cross-origin input',()=>{
 assert.deepEqual(accountInput({displayName:' Dani ',favoriteShopIds:['auchan-021']}),{displayName:'Dani',favoriteShopIds:['auchan-021']});
 for(const d of [null,{displayName:'A',favoriteShopIds:['a','a']},{displayName:'A',favoriteShopIds:['../a']},{displayName:'x'.repeat(81),favoriteShopIds:[]}])assert.equal(accountInput(d),null);
 assert.equal(sameOrigin(new Request('https://kosar.test/api/account',{headers:{Origin:'https://attacker.test'}})),false);
 assert.equal(sameOrigin(new Request('https://kosar.test/api/account',{headers:{Origin:'https://kosar.test'}})),true);
 assert.equal(sameOrigin(new Request('https://kosar.test/api/account')),false);
});
