export type MasterProduct = {
  code: string;
  product_name: string;
  brands?: string;
  quantity?: string;
  image_front_small_url?: string;
  source: "kosarradar";
  keywords?: string[];
};

export const PRODUCT_MASTER: MasterProduct[] = [
  { code:"KR-CAPPY-APPLE-1L", product_name:"Cappy Alma 100%", brands:"Cappy", quantity:"1 l", source:"kosarradar", keywords:["cappy","alma","almalé","apple","juice"] },
  { code:"KR-CAPPY-APPLE-033", product_name:"Cappy Alma 100%", brands:"Cappy", quantity:"0,33 l", source:"kosarradar", keywords:["cappy","alma","almalé","apple","juice"] },
  { code:"KR-PERWOLL-COLOR-3750", product_name:"Perwoll Renew Color", brands:"Perwoll", quantity:"3,75 l / 75 mosás", source:"kosarradar", keywords:["perwoll","color","színes","mosószer"] },
  { code:"KR-SOMAT-GEL", product_name:"Somat mosogatógép gél", brands:"Somat", quantity:"2 × 684 ml", source:"kosarradar", keywords:["somat","mosogatógép","gél","gel"] },
  { code:"KR-MERIDOL-75", product_name:"Meridol Gum Protection", brands:"Meridol", quantity:"75 ml", source:"kosarradar", keywords:["meridol","fogkrém","toothpaste"] },
  { code:"KR-VENUS-TROPICAL", product_name:"Gillette Venus Tropical", brands:"Gillette Venus", quantity:"3 db", source:"kosarradar", keywords:["venus","tropical","borotva","gillette"] }
];

export function searchMaster(q: string) {
  const n = q.toLocaleLowerCase("hu-HU").trim();
  if (!n) return [];
  return PRODUCT_MASTER.filter(p => {
    const hay = [p.product_name,p.brands,p.quantity,...(p.keywords||[])]
      .filter(Boolean).join(" ").toLocaleLowerCase("hu-HU");
    return hay.includes(n);
  });
}
