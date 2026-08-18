import {NextRequest,NextResponse} from "next/server";
import {searchMaster} from "../../../../data/product-master";
type P={code:string;product_name:string;brands?:string;quantity?:string;image_front_small_url?:string;source:"openfoodfacts"|"kosarradar"};
async function off(q:string):Promise<P[]>{
 const u=new URL("https://world.openfoodfacts.org/cgi/search.pl");
 for(const [k,v] of Object.entries({search_terms:q,search_simple:"1",action:"process",json:"1",page_size:"20",fields:"code,product_name,brands,quantity,image_front_small_url"}))u.searchParams.set(k,v);
 const r=await fetch(u.toString(),{headers:{"User-Agent":"KosarRadar/0.4 (https://kosarradar-scll.vercel.app)"},next:{revalidate:3600}});
 if(!r.ok)throw new Error("OFF");
 const d=await r.json();
 return (d.products||[]).filter((p:any)=>p?.code&&p?.product_name).map((p:any)=>({
  code:String(p.code),product_name:String(p.product_name),brands:p.brands||"",quantity:p.quantity||"",image_front_small_url:p.image_front_small_url||"",source:"openfoodfacts" as const
 }));
}
export async function GET(req:NextRequest){
 const q=(req.nextUrl.searchParams.get("q")||"").trim();
 if(q.length<2)return NextResponse.json({products:[]});
 const local=searchMaster(q) as P[]; let remote:P[]=[]; let status="ok";
 try{remote=await off(q)}catch{status="unavailable"}
 const seen=new Set<string>(); const products=[...local,...remote].filter(p=>{if(seen.has(p.code))return false;seen.add(p.code);return true}).slice(0,25);
 return NextResponse.json({products,meta:{openfoodfacts_status:status}});
}
