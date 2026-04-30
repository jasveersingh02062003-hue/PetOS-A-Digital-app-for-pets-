// Lightweight SEO helpers — no extra dependencies.
// Mutates document head tags directly. Safe to call inside useEffect.

type SeoOptions = {
  title?: string;
  description?: string;
  canonical?: string;
  image?: string;
  type?: "website" | "article" | "profile";
  noIndex?: boolean;
  jsonLd?: Record<string, any> | Record<string, any>[];
};

const DEFAULTS = {
  siteName: "Petos",
  title: "Petos — A complete digital life for your pet",
  description:
    "Petos is the all-in-one app for pet parents: social, health vault, AI vet assistant, mating, services and more.",
  image: "/placeholder.svg",
};

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function clearJsonLd() {
  document.head
    .querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"][data-managed="seo"]')
    .forEach((n) => n.remove());
}

function addJsonLd(data: Record<string, any>) {
  const s = document.createElement("script");
  s.type = "application/ld+json";
  s.setAttribute("data-managed", "seo");
  s.text = JSON.stringify(data);
  document.head.appendChild(s);
}

export function applySeo(opts: SeoOptions = {}) {
  const title = opts.title ? `${opts.title} · ${DEFAULTS.siteName}` : DEFAULTS.title;
  const description = opts.description ?? DEFAULTS.description;
  const image = opts.image ?? DEFAULTS.image;
  const url = opts.canonical ?? (typeof window !== "undefined" ? window.location.href : "");
  const type = opts.type ?? "website";

  document.title = title;
  upsertMeta("name", "description", description);
  upsertMeta("name", "robots", opts.noIndex ? "noindex,nofollow" : "index,follow");

  // Open Graph
  upsertMeta("property", "og:site_name", DEFAULTS.siteName);
  upsertMeta("property", "og:title", title);
  upsertMeta("property", "og:description", description);
  upsertMeta("property", "og:type", type);
  upsertMeta("property", "og:image", image);
  if (url) upsertMeta("property", "og:url", url);

  // Twitter
  upsertMeta("name", "twitter:card", "summary_large_image");
  upsertMeta("name", "twitter:title", title);
  upsertMeta("name", "twitter:description", description);
  upsertMeta("name", "twitter:image", image);

  if (url) upsertLink("canonical", url);

  // JSON-LD
  clearJsonLd();
  if (opts.jsonLd) {
    const arr = Array.isArray(opts.jsonLd) ? opts.jsonLd : [opts.jsonLd];
    arr.forEach(addJsonLd);
  }
}

// Schema.org builders
export const jsonLd = {
  organization: () => ({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Petos",
    url: typeof window !== "undefined" ? window.location.origin : "",
    logo: typeof window !== "undefined" ? `${window.location.origin}/placeholder.svg` : "",
    sameAs: [],
  }),
  website: () => ({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Petos",
    url: typeof window !== "undefined" ? window.location.origin : "",
    potentialAction: {
      "@type": "SearchAction",
      target:
        (typeof window !== "undefined" ? window.location.origin : "") +
        "/search?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  }),
  breadcrumb: (items: { name: string; url: string }[]) => ({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  }),
  article: (a: {
    title: string;
    description?: string;
    image?: string;
    datePublished?: string;
    authorName?: string;
    url: string;
  }) => ({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.title,
    description: a.description,
    image: a.image,
    datePublished: a.datePublished,
    author: a.authorName ? { "@type": "Person", name: a.authorName } : undefined,
    mainEntityOfPage: a.url,
  }),
  product: (p: {
    name: string;
    description?: string;
    image?: string;
    price?: number;
    currency?: string;
    url: string;
  }) => ({
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description,
    image: p.image,
    offers:
      p.price != null
        ? {
            "@type": "Offer",
            price: p.price,
            priceCurrency: p.currency ?? "USD",
            url: p.url,
            availability: "https://schema.org/InStock",
          }
        : undefined,
  }),
  faq: (items: { question: string; answer: string }[]) => ({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.question,
      acceptedAnswer: { "@type": "Answer", text: it.answer },
    })),
  }),
  pet: (p: {
    name: string;
    species?: string;
    breed?: string;
    image?: string;
    description?: string;
    url: string;
    priceInr?: number;
    city?: string;
    sellerName?: string;
  }) => ({
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    category: "Pets",
    description: p.description,
    image: p.image,
    brand: p.breed ? { "@type": "Brand", name: p.breed } : undefined,
    additionalProperty: [
      p.species ? { "@type": "PropertyValue", name: "Species", value: p.species } : null,
      p.breed ? { "@type": "PropertyValue", name: "Breed", value: p.breed } : null,
    ].filter(Boolean),
    offers: {
      "@type": "Offer",
      price: p.priceInr ?? 0,
      priceCurrency: "INR",
      url: p.url,
      availability: "https://schema.org/InStock",
      areaServed: p.city,
      seller: p.sellerName ? { "@type": "Organization", name: p.sellerName } : undefined,
    },
  }),
  localBusiness: (b: {
    name: string;
    description?: string;
    image?: string;
    url: string;
    city?: string;
    phone?: string;
    lat?: number;
    lng?: number;
    priceRange?: string;
    category?: string;
  }) => ({
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: b.name,
    description: b.description,
    image: b.image,
    url: b.url,
    telephone: b.phone,
    address: b.city ? { "@type": "PostalAddress", addressLocality: b.city, addressCountry: "IN" } : undefined,
    geo: b.lat != null && b.lng != null ? { "@type": "GeoCoordinates", latitude: b.lat, longitude: b.lng } : undefined,
    priceRange: b.priceRange,
    additionalType: b.category,
  }),
  itemList: (items: { name: string; url: string; image?: string }[]) => ({
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      url: it.url,
      image: it.image,
    })),
  }),
};
