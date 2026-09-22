import { cataloguePage, supportedProduct } from '../../../../lib/catalogue.ts';
import { array, errorResponse, product, record, source, SourceError } from '../../../../lib/gvh.ts';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams, q = (params.get('q') || '').trim(), offset = Number(params.get('offset') || 0);
    if (q.length < 3 || q.length > 100 || !Number.isInteger(offset) || offset < 0 || offset > 1000) throw new SourceError('invalid_input', 'Írj be 3–100 karaktert a kereséshez.', 400);
    if (/^\d{8,14}$/.test(q)) {
      try {
        const detail = await source('/product/' + q);
        const found = product(detail.value);
        if (found.code !== q) throw new SourceError('invalid_response', 'Eltérő termékazonosító érkezett.');
        return Response.json({ products: supportedProduct(detail.value) ? [found] : [], hasMore: false, observedAt: detail.observedAt, stale: detail.stale }, { headers: { 'Cache-Control': 'no-store' } });
      } catch (e) {
        if (e instanceof SourceError && e.code === 'not_found') return Response.json({ products: [], hasMore: false, stale: false }, { headers: { 'Cache-Control': 'no-store' } });
        throw e;
      }
    }
    return Response.json(await cataloguePage('/search?' + new URLSearchParams({ q, limit: '20', offset: String(offset), order: 'relevance' }),offset), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return errorResponse(e); }
}
