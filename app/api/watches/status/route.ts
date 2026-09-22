import {backgroundConfigured} from '../../../../lib/watch-server';
export const dynamic='force-dynamic';
export async function GET(){return Response.json({configured:backgroundConfigured()},{headers:{'Cache-Control':'no-store'}});}
