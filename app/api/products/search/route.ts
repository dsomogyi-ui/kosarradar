import {NextRequest,NextResponse} from "next/server";
export async function GET(req:NextRequest){
 const q=(req.nextUrl.searchParams.get("q")||"").trim(); if(q.length<2)return NextResponse.json({products:[]});
 const u=new URL("https://world.openfoodfacts.org/cgi/search.pl"); u.searchParams.set("search_terms",q);u.searchParams.set("search_simple","1");u.searchParams.set("action","process");u.searchParams.set("json","1");u.searchParams.set("page_size","12");u.searchParams.set("fields","code,product_name,brands,quantity,image_front_small_url");
 try{const r=await fetch(u.toString(),{headers:{"User-Agent":"KosarRadar/0.3 (https://kosarradar-scll.vercel.app)"},next:{revalidate:3600}});if(!r.ok)throw 0;const d=await r.json();return NextResponse.json({products:(d.products||[]).filter((p:any)=>p.code&&p.product_name)});}catch{return NextResponse.json({products:[],error:"A termékadat-forrás most nem elérhető."},{status:200});}
}