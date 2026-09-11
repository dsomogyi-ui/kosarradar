import { errorResponse, getShops } from '../../../lib/gvh.ts';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export async function GET() {
  try { return Response.json(await getShops(), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (e) { return errorResponse(e); }
}
