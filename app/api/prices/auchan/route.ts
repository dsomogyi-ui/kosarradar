import {NextRequest,NextResponse} from "next/server";
import {AUCHAN_PRODUCTS} from "../../../../data/retailer-products";

function plain(html:string){
 return html
  .replace(/<script[\s\S]*?<\/script>/gi," ")
  .replace(/<style[\s\S]*?<\/style>/gi," ")
  .replace(/<[^>]+>/g," ")
  .replace(/&nbsp;|&#160;/gi," ")
  .replace(/&amp;/gi,"&")
  .replace(/\s+/g," ")
  .trim();
}
function parsePrice(text:string){
 const candidates=[
  /(?:^|\s)Ár\s+([\d\s]+)\s*Ft\b/i,
  /Kiemelt ajánlat[\s\S]{0,300}?Ár\s+([\d\s]+)\s*Ft\b/i,
  /PriceHUF\s*([\d\s]+)/i
 ];
 for(const re of candidates){
  const m=text.match(re); if(m){const n=Number(m[1].replace(/\s/g,""));if(Number.isFinite(n)&&n>0)return n}
 }
 return null;
}
export async function GET(req:NextRequest){
 const code=(req.nextUrl.searchParams.get("code")||"").trim();
 const mapped=AUCHAN_PRODUCTS[code];
 if(!mapped)return NextResponse.json({available:false,reason:"not_mapped",store:"Auchan"});
 try{
  const r=await fetch(mapped.url,{headers:{
   "User-Agent":"Mozilla/5.0 (compatible; KosarRadar/0.4; +https://kosarradar-scll.vercel.app)",
   "Accept-Language":"hu-HU,hu;q=0.9"
  },next:{revalidate:900}});
  if(!r.ok)throw new Error(`HTTP ${r.status}`);
  const html=await r.text(); const text=plain(html); const price=parsePrice(text);
  if(!price)return NextResponse.json({available:false,reason:"price_not_found",store:"Auchan",url:mapped.url,label:mapped.label});
  return NextResponse.json({available:true,store:"Auchan",price,currency:"HUF",url:mapped.url,label:mapped.label,price_type:"online",checked_at:new Date().toISOString()});
 }catch(e:any){
  return NextResponse.json({available:false,reason:"fetch_failed",store:"Auchan",url:mapped.url,error:String(e?.message||e)});
 }
}
