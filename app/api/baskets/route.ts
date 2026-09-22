import {serverClient} from '../../../lib/supabase/server';
import {sameOrigin} from '../../../lib/account-validation';
import {snapshotInput} from '../../../lib/saved-baskets';
export const dynamic='force-dynamic';
const reply=(d:unknown,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'private, no-store'}});
async function identity(){const db=await serverClient();if(!db)return null;const {data,error}=await db.auth.getUser();return !error&&data.user?{db,user:data.user}:null;}
export async function GET(){try{
 const auth=await identity();if(!auth)return reply({error:'Jelentkezz be a fiókban tárolt kosarakhoz.'},401);
 const {data,error}=await auth.db.from('saved_baskets').select('id,snapshot,created_at').eq('user_id',auth.user.id).order('created_at',{ascending:false}).limit(50);
 if(error)return reply({error:'A mentett kosarak nem tölthetők be.'},503);
 return reply({baskets:(data||[]).map(v=>({id:v.id,snapshot:v.snapshot,createdAt:v.created_at}))});
}catch{return reply({error:'A mentett kosarak nem tölthetők be.'},503);}}
export async function POST(request:Request){try{
 if(!sameOrigin(request))return reply({error:'Érvénytelen kérés.'},403);
 const auth=await identity();if(!auth)return reply({error:'Jelentkezz be a kosár mentéséhez.'},401);
 const raw=await request.text();if(raw.length>40000)return reply({error:'Túl nagy kosár.'},413);
 let snapshot;try{snapshot=snapshotInput(JSON.parse(raw));}catch{return reply({error:'Hibás kosáradat.'},400);}
 if(!snapshot)return reply({error:'Ellenőrizd a kosár nevét és tételeit.'},400);
 const {data,error}=await auth.db.from('saved_baskets').insert({user_id:auth.user.id,snapshot}).select('id,snapshot,created_at').single();
 if(error)return reply({error:'A kosár mentése nem sikerült.'},503);
 return reply({basket:{id:data.id,snapshot:data.snapshot,createdAt:data.created_at}},201);
}catch{return reply({error:'A kosár mentése nem sikerült.'},503);}}
