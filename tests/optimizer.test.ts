import test from 'node:test';
import assert from 'node:assert/strict';
import { eligiblePrice, optimize } from '../lib/optimizer.ts';
import { restore } from '../lib/storage.ts';
import type { BasketItem, Quote, Shop } from '../lib/types.ts';
const shops: Shop[] = ['A', 'B', 'C'].map(id => ({ id, chainId: id, name: id, city: 'Teszt', postalCode: '0000', address: 'Teszt' }));
const item = (code: string, qty = 1): BasketItem => ({ code, qty, name: code, unit: 'l', packaging: '1', returnFee: 0, bulk: false, priceable: true, source: 'gvh' });
const quote = (code: string, shopId: string, amount: number, extra: Partial<Quote> = {}): Quote => ({ code, shopId, prices: [{ type: 'NORMAL', amount }], returnFee: 0, status: 'ok', stale: false, observedAt: '2026-09-11T08:00:00Z', ...extra });
test('two shops can beat a complete single basket; extra stop can reverse the winner', () => {
  const q = [quote('x', 'A', 100), quote('y', 'A', 500), quote('x', 'B', 400), quote('y', 'B', 100)];
  assert.equal(optimize([item('x'), item('y')], shops.slice(0, 2), q, [], 0)[0].total, 200);
  const withCost = optimize([item('x'), item('y')], shops.slice(0, 2), q, [], 400);
  assert.deepEqual(withCost[0].shopIds, ['B']); assert.equal(withCost[0].total, 500);
});
test('a partial cheap basket cannot win against a complete basket', () => {
  const result = optimize([item('x'), item('y')], shops.slice(0, 2), [quote('x', 'A', 1), quote('x', 'B', 200), quote('y', 'B', 300)], [], 1000);
  assert.equal(result[0].complete, true); assert.deepEqual(result[0].shopIds, ['B']);
  assert.equal(result.find(p => p.id === 'A')?.complete, false);
});
test('loyalty is opt-in per chain; unknown and invalid prices are excluded', () => {
  const prices = [{ type: 'NORMAL' as const, amount: 500 }, { type: 'LOYALTY' as const, amount: 200 }, { type: 'DISCOUNTED' as const, amount: 450 }];
  assert.equal(eligiblePrice(prices, false)?.amount, 450); assert.equal(eligiblePrice(prices, true)?.amount, 200);
  assert.equal(eligiblePrice([{ type: 'NORMAL', amount: NaN }, { type: 'NORMAL', amount: 0 }], true), undefined);
  const result = optimize([item('x')], shops.slice(0, 2), [quote('x', 'A', 500, { prices }), quote('x', 'B', 300)], ['C'], 0);
  assert.equal(result[0].total, 300);
});
test('stale, errored, and missing prices never produce a complete recommendation', () => {
  for (const status of ['stale', 'error', 'missing', 'unsupported'] as const) assert.equal(optimize([item('x')], shops.slice(0, 1), [quote('x', 'A', 1, { status })], [], 0)[0].complete, false);
  assert.equal(optimize([item('x')], shops.slice(0, 1), [quote('x', 'A', 1, { stale: true })], [], 0)[0].complete, false);
});
test('quantity and refundable deposit are included exactly once', () => {
  const p = optimize([item('x', 3)], shops.slice(0, 1), [quote('x', 'A', 199.9, { returnFee: 50 })], [], 0)[0];
  assert.equal(p.subtotal, 599.7); assert.equal(p.deposits, 150); assert.equal(p.total, 749.7);
});
test('different sizes / IDs never substitute for a requested product', () => {
  assert.equal(optimize([item('3750ml')], shops.slice(0, 1), [quote('4000ml', 'A', 100)], [], 0)[0].complete, false);
});
test('three-store coverage cannot be advertised as a two-store complete basket', () => {
  const result = optimize([item('x'), item('y'), item('z')], shops, [quote('x', 'A', 1), quote('y', 'B', 1), quote('z', 'C', 1)], [], 0);
  assert.equal(result.some(p => p.complete), false);
});
test('an unused second shop incurs no extra cost and duplicate plans disappear', () => {
  const result = optimize([item('x')], shops.slice(0, 2), [quote('x', 'A', 1), quote('x', 'B', 5)], [], 100);
  assert.equal(result.length, 2); assert.equal(result[0].travel, 0);
});
test('empty input is not a zero-cost recommendation', () => { assert.deepEqual(optimize([], shops, [], [], 0), []); });
test('saved lists round-trip while damaged or duplicated state is rejected', () => {
  const saved = { basket: [item('x', 2)], shopIds: ['A'], loyalty: [], extraStopCost: 200 };
  assert.deepEqual(restore(JSON.stringify(saved)), saved);
  assert.equal(restore('{broken'), null);
  assert.equal(restore(JSON.stringify({ ...saved, basket: [item('x'), item('x')] })), null);
  assert.equal(restore(JSON.stringify({ ...saved, basket: [item('x', -1)] })), null);
});
