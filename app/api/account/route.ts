import { serverClient } from '../../../lib/supabase/server';
import { getShops } from '../../../lib/gvh';
import { accountInput,sameOrigin } from '../../../lib/account-validation';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
async function identity(){const db=await serverClient();if(!db)return null;const {data,error}=await db.auth.getUser();return !error&&data.user?{db,user:data.user}:null;}
export async function GET(){try{
 const auth=await identity();if(!auth)return reply({user:null},401);
 const {data,error}=await auth.db.from('user_preferences').select('display_name,favorite_shop_ids').eq('user_id',auth.user.id).maybeSingle();
 if(error)return reply({error:'A fiók beállításai most nem tölthetők be.'},503);
 return reply({user:{id:auth.user.id,email:auth.user.email||'',displayName:data?.display_name||'',favoriteShopIds:data?.favorite_shop_ids||[]}});
 }catch{return reply({error:'A fiók most nem érhető el.'},503);}}
export async function PUT(request:Request){try{
 if(!sameOrigin(request))return reply({error:'Érvénytelen kérés.'},403);
 const auth=await identity();if(!auth)return reply({error:'Jelentkezz be a mentéshez.'},401);
 const raw=await request.text();if(raw.length>8000)return reply({error:'Túl nagy kérés.'},413);
 let data;try{data=accountInput(JSON.parse(raw));}catch{return reply({error:'Hibás fiókadat.'},400);}
 if(!data)return reply({error:'Ellenőrizd a nevet és a kedvenc üzleteket.'},400);
 const shops=await getShops();if(data.favoriteShopIds.some(id=>!shops.shops.some(s=>s.id===id)))return reply({error:'Csak Auchan, Tesco, Lidl és Aldi üzlet menthető.'},400);
 const {error}=await auth.db.from('user_preferences').upsert({user_id:auth.user.id,display_name:data.displayName,favorite_shop_ids:data.favoriteShopIds,updated_at:new Date().toISOString()},{onConflict:'user_id'});
 return error?reply({error:'A mentés nem sikerült. Próbáld újra.'},503):reply({saved:true});
 }catch{return reply({error:'A mentés nem sikerült. Próbáld újra.'},503);}}
