import {timingSafeEqual} from 'node:crypto';
import {watchAdmin,backgroundConfigured} from '../../../../lib/watch-server';
import {watchInput,observe,type PricePoint} from '../../../../lib/price-watch';
import {compare} from '../../../../lib/compare';
import {getShops} from '../../../../lib/gvh';
export const dynamic='force-dynamic';
export const maxDuration=300;
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET,actual=request.headers.get('authorization')||'',expected=`Bearer ${secret}`;
 if(!secret||Buffer.byteLength(actual)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(actual),Buffer.from(expected)))return Response.json({error:'Unauthorized'},{status:401});
 const db=watchAdmin();if(!db||!backgroundConfigured())return Response.json({error:'Price monitoring is not configured'},{status:503});
 try{
  const started=Date.now(),deadline=started+240000,cutoff=new Date(started-23*3600000).toISOString();let checked=0,changed=0,failed=0;
  const shops=(await getShops()).shops;
  // Process least recently checked first; unfinished work remains due, never marked as checked.
  const {data,error}=await db.from('price_watches').select('id,config,last_prices,last_checked_at').or(`last_checked_at.is.null,last_checked_at.lt.${cutoff}`).order('last_checked_at',{ascending:true,nullsFirst:true}).limit(30);
  if(error)throw error;
  for(const row of data||[]){
   if(Date.now()>deadline-90000)break;const config=watchInput(row.config);if(!config){failed++;continue;}
   try{
    const result=await compare({items:config.items.map(({code,qty})=>({code,qty})),shopIds:config.shopIds,loyaltyChainIds:config.loyalty,extraStopCost:0});
    const {prices,events}=observe(row.id,config,(row.last_prices||{}) as Record<string,PricePoint>,result.quotes,shops);
    const status=result.quotes.every(q=>q.status==='ok'&&!q.stale)?'ok':result.quotes.some(q=>q.status==='ok'&&!q.stale)?'partial':'unavailable';
    const notices=events.map(e=>({...e,watchName:config.name,productName:config.items.find(i=>i.code===e.code)?.name||e.code}));
    const {data:applied,error}=await db.rpc('commit_price_check',{p_id:row.id,p_expected:row.last_checked_at,p_prices:prices,p_events:notices,p_checked:new Date().toISOString(),p_status:status});
    if(error)throw error;if(applied){checked++;changed+=events.length;if(status==='unavailable')failed++;}
   }catch{failed++;}
  }
  return Response.json({checked,changed,failed,remaining:(data?.length||0)-checked},{status:failed?503:200,headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Price check failed'},{status:503});}
}
