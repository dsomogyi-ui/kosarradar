import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { POST } from '../app/api/compare/route.ts';
import { GET as search } from '../app/api/products/search/route.ts';
import { GET as legacy } from '../app/api/prices/auchan/route.ts';
test('HTTP validation returns 400/413 instead of misreporting an upstream outage', async () => {
  for (const body of ['{broken', 'null', '{}', '{"items":[null],"shopIds":["A"],"loyaltyChainIds":[]}']) {
    const r = await POST(new Request('https://test.local/api/compare', { method: 'POST', body }));
    assert.equal(r.status, 400); assert.equal((await r.json()).error.code, 'invalid_input');
  }
  assert.equal((await POST(new Request('https://test.local/api/compare', { method: 'POST', body: ' '.repeat(17000) }))).status, 413);
  assert.equal((await search(new Request('https://test.local/api/products/search?q=ab'))).status, 400);
});
test('barcode lookup uses exact product endpoint, while missing barcodes produce an empty result', async () => {
  const original = globalThis.fetch;
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/product.json', import.meta.url), 'utf8'));
  globalThis.fetch = async input => {
    if (String(input).endsWith('/product/' + fixture.id)) return Response.json(fixture);
    return new Response('', { status: 404 });
  };
  try {
    const r = await search(new Request('https://test.local/api/products/search?q=' + fixture.id));
    assert.equal(r.status, 200); assert.equal((await r.json()).products[0].code, fixture.id);
    const missing = await search(new Request('https://test.local/api/products/search?q=0000000000000'));
    assert.equal(missing.status, 200); assert.deepEqual((await missing.json()).products, []);
  } finally { globalThis.fetch = original; }
});
test('the retired parser cannot leak an unrelated or misleading Auchan price', async () => {
  const r = await legacy(); assert.equal(r.status, 410); assert.equal((await r.json()).available, false);
});
