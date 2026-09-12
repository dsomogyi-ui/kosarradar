import { serverClient } from '../../../lib/supabase/server';
import { NextResponse } from 'next/server';
export async function GET(request:Request){
 const url=new URL(request.url),code=url.searchParams.get('code');
 const destination=url.searchParams.get('recovery')==='1'?'/account?recovery=1':'/account';
 try{const db=await serverClient();if(db&&code){const {error}=await db.auth.exchangeCodeForSession(code);if(!error)return NextResponse.redirect(new URL(destination,url.origin));}}catch{}
 return NextResponse.redirect(new URL('/account?authError=1',url.origin));
}
