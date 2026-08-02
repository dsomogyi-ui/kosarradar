import { NextResponse } from "next/server";

type Source = {
  id: string;
  store: string;
  url: string;
  product: string;
};

type PriceResult = {
  id: string;
  store: string;
  product: string;
  url: string;
  price: number | null;
  currency: "HUF";
  checkedAt: string;
  status: "ok" | "unavailable" | "error";
  note: string;
};

const SOURCES: Source[] = [
  {
    id: "auchan",
    store: "Auchan",
    product: "Perwoll Color 3,75 l / 75 mosás",
    url: "https://auchan.hu/shop/perwoll-color-kimelo-mososzer-75-mosas-3750-ml.p-802286"
  },
  {
    id: "dm",
    store: "dm",
    product: "Perwoll Color 4 l / 80 mosás",
    url: "https://www.dm.hu/p/d/2560966/perwoll-finommosogel-szines-ruhakhoz-80-mosas"
  },
  {
    id: "rossmann",
    store: "Rossmann",
    product: "Perwoll Color 3,75 l / 75 mosás",
    url: "https://shop.rossmann.hu/termek/perwoll-color-mososzer-75-mosas-3750-ml"
  }
];

function normaliseNumber(value: string): number | null {
  const cleaned = value.replace(/&nbsp;|\u00a0|\s/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 100 ? Math.round(n) : null;
}

function extractPrice(html: string): number | null {
  const patterns: RegExp[] = [
    /property=["']product:price:amount["'][^>]*content=["']([0-9.,\s]+)["']/i,
    /content=["']([0-9.,\s]+)["'][^>]*property=["']product:price:amount["']/i,
    /["']price["']\s*:\s*["']([0-9.,\s]+)["']/i,
    /["']price["']\s*:\s*([0-9.,]+)/i,
    /(?:Ár|price)[^0-9]{0,80}([0-9][0-9\s\u00a0]{2,})\s*(?:Ft|HUF)/i,
    /([0-9][0-9\s\u00a0]{2,})\s*(?:Ft|HUF)/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const price = normaliseNumber(match[1]);
      if (price && price < 100000) return price;
    }
  }
  return null;
}

async function fetchSource(source: Source): Promise<PriceResult> {
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch(source.url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; KosarRadar/0.2; +https://kosarradar-scll.vercel.app)",
        accept: "text/html,application/xhtml+xml"
      },
      next: { revalidate: 1800 }
    });

    if (!response.ok) {
      return {
        ...source,
        price: null,
        currency: "HUF",
        checkedAt,
        status: "error",
        note: `A forrás ${response.status} választ adott.`
      };
    }

    const html = await response.text();
    const price = extractPrice(html);

    return {
      ...source,
      price,
      currency: "HUF",
      checkedAt,
      status: price ? "ok" : "unavailable",
      note: price
        ? "Aktuális online termékoldalról lekérve."
        : "Az oldal elérhető, de az ár nem volt biztonságosan kiolvasható."
    };
  } catch (error) {
    return {
      ...source,
      price: null,
      currency: "HUF",
      checkedAt,
      status: "error",
      note: error instanceof Error ? error.message : "Ismeretlen lekérési hiba."
    };
  }
}

export async function GET() {
  const results = await Promise.all(SOURCES.map(fetchSource));
  return NextResponse.json(
    {
      productGroup: "Perwoll Color",
      results,
      disclaimer:
        "Az árak online árak. A konkrét áruház polcára, készlete és hűségkártyás ára eltérhet."
    },
    {
      headers: {
        "Cache-Control": "s-maxage=1800, stale-while-revalidate=3600"
      }
    }
  );
}
