import { authConfig } from '../../../../lib/supabase/server';
export const dynamic='force-dynamic';
export async function GET(){
 const config=authConfig();
 if(!config)return Response.json({configured:false},{headers:{'Cache-Control':'no-store'}});
 try{
 const r=await fetch(config.url+'/auth/v1/settings',{headers:{apikey:config.key},cache:'no-store',signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error();const d=await r.json();
 return Response.json({configured:true,...config,google:d.external?.google===true,facebook:d.external?.facebook===true,email:d.external?.email===true,signup:d.disable_signup!==true},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({configured:false,error:'A bejelentkezési szolgáltatás most nem érhető el.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
