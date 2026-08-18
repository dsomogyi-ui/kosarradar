import { NextRequest, NextResponse } from "next/server";
import { searchMaster } from "../../../../data/product-master";

type Product = {
  code: string;
  product_name: string;
  brands?: string;
  quantity?: string;
  image_front_small_url?: string;
  source: "openfoodfacts" | "kosarradar";
};

async function searchOpenFoodFacts(q: string): Promise<Product[]> {
  // Open Food Facts docs: full-text search is supported by the v1 search API.
  const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
  url.searchParams.set("search_terms", q);
  url.searchParams.set("search_simple", "1");
  url.searchParams.set("action", "process");
  url.searchParams.set("json", "1");
  url.searchParams.set("page_size", "20");
  url.searchParams.set("fields", "code,product_name,brands,quantity,image_front_small_url");

  const r = await fetch(url.toString(), {
    headers: {
      "User-Agent": "KosarRadar/0.3.1 (https://kosarradar-scll.vercel.app)"
    },
    next: { revalidate: 3600 }
  });
  if (!r.ok) throw new Error(`OFF ${r.status}`);

  const data = await r.json();
  return (data.products || [])
    .filter((p: any) => p?.code && p?.product_name)
    .map((p: any) => ({
      code: String(p.code),
      product_name: String(p.product_name),
      brands: p.brands || "",
      quantity: p.quantity || "",
      image_front_small_url: p.image_front_small_url || "",
      source: "openfoodfacts" as const
    }));
}

function dedupe(items: Product[]) {
  const seen = new Set<string>();
  return items.filter(p => {
    const key = p.code || `${p.product_name}|${p.brands}|${p.quantity}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ products: [] });

  const local = searchMaster(q) as Product[];
  let remote: Product[] = [];
  let remoteStatus: "ok" | "unavailable" = "ok";

  try {
    remote = await searchOpenFoodFacts(q);
  } catch {
    remoteStatus = "unavailable";
  }

  const products = dedupe([...local, ...remote]).slice(0, 25);

  return NextResponse.json({
    products,
    meta: {
      local_count: local.length,
      openfoodfacts_count: remote.length,
      openfoodfacts_status: remoteStatus
    }
  });
}
