import {getShops,errorResponse,SourceError,validId} from '../../../lib/gvh';
import {sameOrigin} from '../../../lib/account-validation';
import {matrixInput,validPoint,type Vehicle} from '../../../lib/travel';
export const dynamic='force-dynamic';
let active=0;
export async function GET(){return Response.json({configured:!!process.env.ORS_API_KEY},{headers:{'Cache-Control':'no-store'}});}
export async function POST(request:Request){try{
 if(!sameOrigin(request))throw new SourceError('origin','Érvénytelen kérés.',403);
 if(!process.env.ORS_API_KEY)throw new SourceError('not_configured','A közúti útvonaltervező még nincs bekapcsolva. A kalkulátorban megadhatod az út hosszát.',503);
 const raw=await request.text();if(raw.length>4000)throw new SourceError('size','Túl nagy kérés.',413);
 let input;try{input=JSON.parse(raw);}catch{throw new SourceError('input','Hibás útvonaladat.',400);}
 if(!validPoint(input?.origin)||!Array.isArray(input.shopIds)||input.shopIds.length<1||input.shopIds.length>8||input.shopIds.some((id:unknown)=>!validId(id))||new Set(input.shopIds).size!==input.shopIds.length||!['petrol','diesel','hybrid','electric','bicycle','walking'].includes(input.vehicle))throw new SourceError('input','Válassz kiindulópontot, járművet és legfeljebb 8 üzletet.',400);
 const catalog=await getShops(),shops=input.shopIds.map((id:string)=>catalog.shops.find(s=>s.id===id));
 if(shops.some((s:unknown)=>!validPoint(s)))throw new SourceError('location','Hiányzó vagy ismeretlen üzlethelyszín.',400);
 if(active>=2)throw new SourceError('busy','Az útvonaltervező foglalt. Próbáld újra.',429);
 const profile:Record<Vehicle,string>={petrol:'driving-car',diesel:'driving-car',hybrid:'driving-car',electric:'driving-car',bicycle:'cycling-regular',walking:'foot-walking'};
 active++;
 try{
  const r=await fetch(`https://api.openrouteservice.org/v2/matrix/${profile[input.vehicle as Vehicle]}`,{method:'POST',headers:{Authorization:process.env.ORS_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({locations:[input.origin,...shops].map(p=>[p.longitude,p.latitude]),metrics:['distance','duration'],units:'m'}),signal:AbortSignal.timeout(20000),cache:'no-store'});
  if(!r.ok)throw new SourceError('routing','Az útvonaladat most nem érhető el. Próbáld újra.');
  const raw=await r.text();if(raw.length>200000)throw new SourceError('routing','Hibás útvonalválasz.');
  const matrix=matrixInput(JSON.parse(raw),input.shopIds);if(!matrix)throw new SourceError('routing','Hiányos útvonalválasz.');
  return Response.json({matrix},{headers:{'Cache-Control':'private, no-store'}});
 }finally{active--;}
}catch(e){return errorResponse(e);}}
