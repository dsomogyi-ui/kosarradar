import { getCategories } from '../../../lib/catalogue.ts';
import { errorResponse } from '../../../lib/gvh.ts';
export const dynamic='force-dynamic';
export async function GET(){try{return Response.json(await getCategories(),{headers:{'Cache-Control':'no-store'}});}catch(e){return errorResponse(e);}}
