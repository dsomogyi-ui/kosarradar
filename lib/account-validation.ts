export function accountInput(body:unknown):{displayName:string;favoriteShopIds:string[]}|null{
 if(!body||typeof body!=='object'||Array.isArray(body))return null;
 const d=body as Record<string,unknown>;
 if(typeof d.displayName!=='string'||d.displayName.trim().length>80||!Array.isArray(d.favoriteShopIds)||d.favoriteShopIds.length>50||d.favoriteShopIds.some(id=>typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(id))||new Set(d.favoriteShopIds).size!==d.favoriteShopIds.length)return null;
 return {displayName:d.displayName.trim(),favoriteShopIds:d.favoriteShopIds as string[]};
}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');return !!origin&&origin===new URL(request.url).origin;}
