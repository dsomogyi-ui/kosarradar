import { errorResponse, SourceError } from '../../../lib/gvh';
import { validPlace } from '../../../lib/location';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const q=(new URL(request.url).searchParams.get('q')||'').trim();
    if(q.length<2||q.length>100)throw new SourceError('invalid_input','Legalább két betűvel keress települést.',400);
    const url='https://geocoding-api.open-meteo.com/v1/search?'+new URLSearchParams({name:q,count:'15',language:'hu',format:'json',countryCode:'HU'});
    const r=await fetch(url,{next:{revalidate:86400},signal:AbortSignal.timeout(10000)});
    if(!r.ok)throw new SourceError('places_unavailable','A településkereső most nem érhető el. Próbáld újra.');
    const d=await r.json();
    const places=(Array.isArray(d.results)?d.results:[]).filter((p:any)=>p.country_code==='HU'&&/^PPL/.test(p.feature_code||''))
      .map((p:any)=>({id:p.id,name:p.name,region:p.admin1||'',latitude:p.latitude,longitude:p.longitude})).filter(validPlace);
    return Response.json({places},{headers:{'Cache-Control':'public, max-age=3600'}});
  }catch(e){return errorResponse(e);}
}
