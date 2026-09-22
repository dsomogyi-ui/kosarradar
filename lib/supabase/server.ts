import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
export function authConfig(){
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 return url&&key?{url,key}:null;
}
// Used only in route handlers: refreshed cookies are written to the response.
export async function serverClient(){
 const config=authConfig();if(!config)return null;
 const jar=await cookies();
 return createServerClient(config.url,config.key,{cookies:{getAll:()=>jar.getAll(),setAll:values=>values.forEach(({name,value,options})=>jar.set(name,value,options))}});
}
