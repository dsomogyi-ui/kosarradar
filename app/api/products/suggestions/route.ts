import { array, errorResponse, product, record, source, SourceError } from '../../../../lib/gvh.ts';
import { supportedProduct } from '../../../../lib/catalogue.ts';
import { matchesNeed, tokens } from '../../../../lib/shopping-text.ts';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams, q = (params.get('q') || '').trim(), offset = Number(params.get('offset') || 0);
    const words = tokens(q);
    if (!words.length || q.length > 100 || words[0].length < 3 || !Number.isInteger(offset) || offset < 0 || offset > 1000 || offset % 100 !== 0) throw new SourceError('invalid_input', 'Legalább 3 betűs terméknevet vagy márkát adj meg.', 400);
    if (/^\d{8,14}$/.test(q)) {
      try {
        const detail = await source('/product/' + q), found = product(detail.value);
        if (found.code !== q) throw new SourceError('invalid_response', 'Eltérő termékazonosító érkezett.');
        return Response.json({ products: supportedProduct(detail.value) ? [found] : [], hasMore: false, stale: detail.stale }, { headers: { 'Cache-Control': 'no-store' } });
      } catch (e) {
        if (e instanceof SourceError && e.code === 'not_found') return Response.json({ products: [], hasMore: false, stale: false }, { headers: { 'Cache-Control': 'no-store' } });
        throw e;
      }
    }
    const d = await source('/search?' + new URLSearchParams({ q: words[0], offset: String(offset), limit: '100', order: 'relevance' }), 3600000);
    const body = record(d.value), rows = array(body.products);
    const products = rows.filter(supportedProduct).map(product).filter(p => matchesNeed(p.name, q));
    return Response.json({ products, hasMore: rows.length === 100 && typeof body.count === 'number' && offset + rows.length < body.count && offset < 1000, stale: d.stale }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return errorResponse(e); }
}
