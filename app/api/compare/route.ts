import { compare } from '../../../lib/compare.ts';
import { errorResponse, SourceError } from '../../../lib/gvh.ts';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;
export async function POST(request: Request) {
  try {
    if (Number(request.headers.get('content-length') || 0) > 16384) throw new SourceError('invalid_input', 'Túl nagy kérés.', 413);
    const raw = await request.text();
    if (raw.length > 16384) throw new SourceError('invalid_input', 'Túl nagy kérés.', 413);
    let data: unknown;
    try { data = JSON.parse(raw); } catch { throw new SourceError('invalid_input', 'Hibás kérés.', 400); }
    return Response.json(await compare(data), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return errorResponse(e); }
}
