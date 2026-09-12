import { cataloguePage,getCategories,isLeaf } from '../../../../lib/catalogue.ts';
import { SourceError,errorResponse } from '../../../../lib/gvh.ts';
export const dynamic='force-dynamic';
export const maxDuration=40;
export async function GET(request:Request){try{
 const q=new URL(request.url).searchParams,id=Number(q.get('id')),offset=Number(q.get('offset')||0);
 if(!Number.isInteger(id)||id<1||!Number.isInteger(offset)||offset<0||offset>1000)throw new SourceError('invalid_input','Válassz egy termékkategóriát.',400);
 if(!isLeaf((await getCategories()).categories,id))throw new SourceError('invalid_input','Válassz egy alkategóriát.',400);
 return Response.json(await cataloguePage('/products-by-category/'+id+'?'+new URLSearchParams({limit:'20',offset:String(offset),order:'unitAmount_asc'}),offset),{headers:{'Cache-Control':'no-store'}});
 }catch(e){return errorResponse(e);}}
