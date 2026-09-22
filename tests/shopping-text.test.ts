import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNeed, splitList, packageChoice, matchesNeed, selectedBasket } from '../lib/shopping-text.ts';
import type { Product } from '../lib/types.ts';
const apple: Product = { code: '5993330001081', name: 'Cappy 100% almalé 1 l', packaging: '1', unit: 'l', bulk: false, priceable: true, returnFee: 0, source: 'gvh' };
test('free text preserves brand, decimal amounts and quantity dimensions', () => {
  for (const text of ['Cappy almalé, 2 liter', '2 liter Cappy almalé', 'Cappy almalé,2 liter']) {
    const need = parseNeed(text); assert.equal(need.query, 'Cappy almalé'); assert.equal(packageChoice(need, apple).qty, 2);
  }
  assert.deepEqual(splitList('Cappy almalé, 2 liter; tej, 1,5 liter\nkenyér'), ['Cappy almalé, 2 liter', 'tej, 1,5 liter', 'kenyér']);
  assert.equal(parseNeed('tej, 1,5 liter').amount, 1.5);
  assert.equal(packageChoice(parseNeed('Cappy almalé, 2 liter'), { ...apple, packaging: '1.5' }).qty, 2);
  assert.ok(packageChoice(parseNeed('Cappy almalé, 2 kg'), apple).error);
  assert.ok(parseNeed('Cappy almalé, -2 liter').error);
  assert.ok(packageChoice(parseNeed('Cappy almalé, 100 db'), apple).error);
  assert.equal(matchesNeed(apple.name, 'Cappy almalé'), true);
  assert.equal(matchesNeed('Sió 100% almalé 1 l', 'Cappy almalé'), false);
  assert.equal(matchesNeed('Cappy narancs nektár 1 l', 'Cappy almalé'), false);
  assert.equal(matchesNeed('Tejföl 20% 330 g', 'tej'), false);
});
test('unresolved rows have no invented priceable product and duplicate selections combine', () => {
  const selected = { ...apple, qty: 2 };
  const basket = selectedBasket([{ id: 'a', text: 'Cappy almalé, 2 liter', selected }, { id: 'b', text: 'tej' }, { id: 'c', text: 'Cappy almalé', selected: { ...apple, qty: 1 } }]);
  assert.equal(basket.length, 1); assert.equal(basket[0].qty, 3);
});
