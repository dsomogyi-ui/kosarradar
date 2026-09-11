import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { product, prices, source, SourceError } from '../lib/gvh.ts';
import { compare } from '../lib/compare.ts';
const fixture = JSON.parse(readFileSync(new URL('./fixtures/product.json', import.meta.url), 'utf8'));
test('verified GVH schema preserves exact ID, package and price types', () => {
  assert.equal(product(fixture).code, '9000101810325'); assert.equal(product(fixture).packaging, '3.75');
  assert.equal(prices(fixture.chainStores[0].prices)[0].amount, 7199);
  assert.throws(() => product({ ...fixture, returnFee: undefined }), SourceError);
  assert.throws(() => product({ ...fixture, packaging: null }), SourceError);
  assert.deepEqual(prices([{ type: 'PERSONAL', amount: 1 }, { type: 'NORMAL', amount: -1 }]), []);
});
test('cache preserves timestamp, deduplicates requests and clearly marks stale fallback', async () => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ ok: true }); };
  try {
    const [first, second] = await Promise.all([source('/cache-test', -1), source('/cache-test', -1)]);
    assert.equal(calls, 1); assert.equal(first.observedAt, second.observedAt);
    globalThis.fetch = async () => { throw new Error('offline'); };
    const stale = await source('/cache-test', -1);
    assert.equal(stale.stale, true); assert.equal(stale.observedAt, first.observedAt);
  } finally { globalThis.fetch = original; }
});
test('comparison uses shop prices rather than national minimum, and rejects forged input', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async input => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith('/chain-stores')) return Response.json({ chainStores: [{ uuid: 'chainA', name: 'A' }, { uuid: 'chainB', name: 'B' }] });
    if (path.endsWith('/shops')) return Response.json({ shops: ['A', 'B'].map(id => ({ uuid: id, chainStoreUuid: 'chain' + id, city: 'Teszt', postalCode: '0000', address: id })) });
    if (path.includes('/shop/')) return Response.json({ shops: [{ uuid: fixture.id, shopUuid: 'A', prices: [{ type: 'NORMAL', amount: 7500 }] }, { uuid: fixture.id, shopUuid: 'B', prices: [{ type: 'NORMAL', amount: 8000 }, { type: 'LOYALTY', amount: 7000 }] }] });
    return Response.json(fixture);
  };
  const payload = { items: [{ code: fixture.id, qty: 2 }], shopIds: ['A', 'B'], loyaltyChainIds: [], extraStopCost: 0 };
  try {
    const data = await compare(payload); assert.equal(data.plans[0].total, 15000); assert.equal(data.plans[0].lines[0].unitPrice, 7500);
    const member = await compare({ ...payload, loyaltyChainIds: ['chainB'] }); assert.equal(member.plans[0].total, 14000);
    await assert.rejects(compare({ ...payload, items: [{ code: fixture.id, qty: 0 }] }));
    await assert.rejects(compare({ ...payload, shopIds: ['forged'] }));
    await assert.rejects(compare({ ...payload, items: [payload.items[0], payload.items[0]] }));
    await assert.rejects(compare({ ...payload, extraStopCost: -1 }));
  } finally { globalThis.fetch = original; }
});
