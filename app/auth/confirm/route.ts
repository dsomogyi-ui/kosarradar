import { serverClient } from '../../../lib/supabase/server';
import { NextResponse } from 'next/server';
export async function GET(request:Request){
 const url=new URL(request.url),hash=url.searchParams.get('token_hash'),type=url.searchParams.get('type');
 try{const db=await serverClient();if(db&&hash&&(type==='signup'||type==='recovery'||type==='email_change')){const {error}=await db.auth.verifyOtp({token_hash:hash,type});if(!error)return NextResponse.redirect(new URL(type==='recovery'?'/account?recovery=1':'/account',url.origin));}}catch{}
 return NextResponse.redirect(new URL('/account?authError=1',url.origin));
}
