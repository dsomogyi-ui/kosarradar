import {serverClient} from '../../../lib/supabase/server';
import {sameOrigin} from '../../../lib/account-validation';
import {watchInput} from '../../../lib/price-watch';
import {backgroundConfigured} from '../../../lib/watch-server';
import {getShops} from '../../../lib/gvh';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
async function identity(){const db=await serverClient();if(!db)return null;const {data,error}=await db.auth.getUser();return !error&&data.user?{db,user:data.user}:null;}
export async function GET(){try{const a=await identity();if(!a)return reply({error:'Jelentkezz be az árfigyeléseidhez.'},401);
 const [w,n]=await Promise.all([a.db.from('price_watches').select('id,config,last_checked_at,last_status').eq('user_id',a.user.id).order('created_at',{ascending:false}),a.db.from('price_alerts').select('id,watch_id,event,read').eq('user_id',a.user.id).order('created_at',{ascending:false}).limit(100)]);
 if(w.error||n.error)return reply({error:'Az árfigyelések nem tölthetők be.'},503);
 return reply({watches:w.data.flatMap(row=>{const config=watchInput(row.config);return config?[{...row,config}]:[];}),notices:n.data.map(n=>({...n.event,id:String(n.id),watchId:n.watch_id,read:n.read}))});
}catch{return reply({error:'Az árfigyelések nem tölthetők be.'},503);}}
export async function POST(request:Request){try{
 if(!sameOrigin(request))return reply({error:'Érvénytelen kérés.'},403);const a=await identity();if(!a)return reply({error:'Jelentkezz be az árfigyeléshez.'},401);
 if(!backgroundConfigured())return reply({error:'A háttérfigyelés még nincs bekapcsolva.'},503);
 const raw=await request.text();if(raw.length>16000)return reply({error:'Túl nagy figyelési lista.'},413);let config;try{config=watchInput(JSON.parse(raw));}catch{return reply({error:'Hibás figyelési lista.'},400);}if(!config)return reply({error:'Ellenőrizd a termékeket, az üzleteket és a jelzési feltételeket.'},400);
 const catalog=await getShops();if(config.shopIds.some(id=>!catalog.shops.some(s=>s.id===id))||config.loyalty.some(id=>!catalog.chains.some(c=>c.id===id)))return reply({error:'Ismeretlen üzlet vagy lánc.'},400);
 const {data,error}=await a.db.from('price_watches').insert({user_id:a.user.id,config}).select('id,config,last_checked_at,last_status').single();if(error)return reply({error:'Nem sikerült menteni. Legfeljebb 10 háttérfigyelés állítható be.'},503);
 return reply({watch:data},201);
}catch{return reply({error:'Nem sikerült elmenteni az árfigyelést.'},503);}}
export async function DELETE(request:Request){try{if(!sameOrigin(request))return reply({error:'Érvénytelen kérés.'},403);const a=await identity();if(!a)return reply({error:'Jelentkezz be.'},401);const id=new URL(request.url).searchParams.get('id');if(!id||!/^[a-f0-9-]{36}$/.test(id))return reply({error:'Hibás azonosító.'},400);const {error}=await a.db.from('price_watches').delete().eq('id',id).eq('user_id',a.user.id);return error?reply({error:'A törlés nem sikerült.'},503):reply({ok:true});}catch{return reply({error:'A törlés nem sikerült.'},503);}}
export async function PATCH(request:Request){try{if(!sameOrigin(request))return reply({error:'Érvénytelen kérés.'},403);const a=await identity();if(!a)return reply({error:'Jelentkezz be.'},401);const {error}=await a.db.from('price_alerts').update({read:true}).eq('user_id',a.user.id).eq('read',false);return error?reply({error:'Nem sikerült olvasottnak jelölni.'},503):reply({ok:true});}catch{return reply({error:'Nem sikerült olvasottnak jelölni.'},503);}}
