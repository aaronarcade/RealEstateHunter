#!/usr/bin/env node

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

function parseArgs(argv) {
  const args = {
    source: null,
    url: null,
    market: null,
    marketArea: null,
    output: null,
    notes: '',
    currency: 'USD',
    city: null,
    state: null,
    country: null,
    countryCode: null,
    where: null,
    filterCity: null,
    maxPages: null,
    maxListings: 1000,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--source' && value) { args.source = value; i += 1; }
    else if (flag === '--url' && value) { args.url = value; i += 1; }
    else if (flag === '--market' && value) { args.market = value; i += 1; }
    else if (flag === '--market-area' && value) { args.marketArea = value; i += 1; }
    else if (flag === '--output' && value) { args.output = join(REPO_ROOT, value); i += 1; }
    else if (flag === '--notes' && value) { args.notes = value; i += 1; }
    else if (flag === '--currency' && value) { args.currency = value; i += 1; }
    else if (flag === '--city' && value) { args.city = value; i += 1; }
    else if (flag === '--state' && value) { args.state = value; i += 1; }
    else if (flag === '--country' && value) { args.country = value; i += 1; }
    else if (flag === '--country-code' && value) { args.countryCode = value; i += 1; }
    else if (flag === '--where' && value) { args.where = value; i += 1; }
    else if (flag === '--filter-city' && value) { args.filterCity = value; i += 1; }
    else if (flag === '--max-pages' && value) { args.maxPages = Number(value); i += 1; }
    else if (flag === '--max-listings' && value) { args.maxListings = Number(value); i += 1; }
  }
  if (!args.source || !args.market || !args.marketArea || !args.output) {
    console.error('Required: --source --market --market-area --output [--url]');
    process.exit(1);
  }
  return args;
}

async function fetchText(url, headers = {}, retries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': UA, ...headers },
      });
      if (!response.ok) throw new Error(`Fetch failed (${response.status}) for ${url}`);
      return response.text();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 750));
      }
    }
  }
  throw lastError;
}

function realtorPageUrl(baseUrl, page) {
  const trimmed = baseUrl.replace(/\/?$/, '/');
  if (page === 1) return trimmed;
  if (trimmed.includes('/fr/')) return `${trimmed}page/${page}`;
  return `${trimmed}${trimmed.includes('?') ? '&' : '?'}page=${page}`;
}

function decodeHtml(value) {
  return value.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'");
}

function unwrapAstro(value) {
  if (Array.isArray(value)) {
    if (value.length === 2 && value[0] === 0) return unwrapAstro(value[1]);
    return value.map(unwrapAstro);
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, nested] of Object.entries(value)) out[key] = unwrapAstro(nested);
    return out;
  }
  return value;
}

function parseJsonLdItemLists(html) {
  const listings = [];
  for (const match of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed['@type'] !== 'ItemList') continue;
      for (const entry of parsed.itemListElement ?? []) {
        const item = entry?.item;
        if (!item?.url) continue;
        const about = item.about ?? {};
        const address = about.address ?? {};
        const price = Number(item.offers?.price);
        listings.push({
          address: about.containedInPlace?.name || item.name || 'Property',
          city: titleCaseSlug(address.addressLocality) || address.addressLocality || 'Unknown',
          beds: about.numberOfBedrooms ?? null,
          baths: about.numberOfBathroomsTotal ?? null,
          asking_price: Number.isFinite(price) ? price : null,
          listing_url: item.url,
          lat: about.geo?.latitude ?? null,
          lng: about.geo?.longitude ?? null,
          mls_id: item.url.split('_').pop(),
        });
      }
    } catch {
      // ignore malformed blocks
    }
  }
  return listings;
}

function titleCaseSlug(value) {
  if (!value) return null;
  return String(value).replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseNextData(html) {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
  if (!match) throw new Error('__NEXT_DATA__ not found');
  return JSON.parse(match[1]);
}

function parseRealtorInternational(html, { marketArea, currency, city, state, country }) {
  const scriptMatch = html.match(/<script[^>]*type="application\/json"[^>]*>(.*?)<\/script>/s);
  if (!scriptMatch) throw new Error('Realtor JSON payload not found');

  const payload = JSON.parse(scriptMatch[1]);
  const details = [];
  const walk = (node) => {
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }
    if (!node || typeof node !== 'object') return;
    if (node.__typename === 'ListingDetail' && node.displayAddress) details.push(node);
    for (const value of Object.values(node)) walk(value);
  };
  walk(payload);

  const eurPrices = [...html.matchAll(/class="displayListingPrice">(?:EUR\s*)?€([\d,]+)/g)].map((m) => Number(m[1].replace(/,/g, '')));
  const jpyPrices = [...html.matchAll(/class="displayListingPrice">(?:JPY\s*)?¥([\d,]+)/g)].map((m) => Number(m[1].replace(/,/g, '')));
  const usdPrices = [...html.matchAll(/class="displayListingPrice">(?:USD\s*)?\$([\d,]+)/g)].map((m) => Number(m[1].replace(/,/g, '')));
  const priceList = eurPrices.length ? eurPrices : jpyPrices.length ? jpyPrices : usdPrices;

  return details.map((detail, index) => {
    const detailPath = detail['detailPageUrl({"language":"en"})'];
    const listingUrl = detailPath
      ? `https://www.realtor.com${detailPath}`
      : `https://www.realtor.com/international/${country?.toLowerCase()}/${city?.toLowerCase()}/`;
    const buildingSize = detail['buildingSize({"language":"en","unit":"SQUARE_METERS"})'];
    const sqm = typeof buildingSize === 'number' ? buildingSize : null;
    return {
      address: detail.displayAddress,
      city: city || detail.displayAddress.split(',')[0].trim(),
      state: state || '',
      country,
      asking_price: priceList[index] ?? null,
      beds: detail.bedrooms ?? null,
      baths: detail.baths ?? detail.bathrooms ?? null,
      sqft: sqm != null ? Math.round(sqm * 10.7639) : null,
      mls_id: detail.sourceListingId || detail.id,
      listing_url: listingUrl,
      lat: detail.geoLocation?.latitude ?? null,
      lng: detail.geoLocation?.longitude ?? null,
      market_area: marketArea,
      source_portal: 'realtor_international',
      currency,
    };
  });
}

function imovirtualListingUrl(item) {
  const href = item.href || '';
  if (href.startsWith('http')) return href.replace('[lang]', 'pt');
  if (href.startsWith('/')) return `https://www.imovirtual.com${href.replace('[lang]', 'pt')}`;
  if (item.slug) return `https://www.imovirtual.com/pt/anuncio/${item.slug}`;
  return `https://www.imovirtual.com/pt/anuncio/ID${item.id}`;
}

function mapImovirtualItem(item, { marketArea, currency, city, state, country }) {
  const loc = item.location?.address ?? {};
  const street = loc.street?.name ? `${loc.street.name}${loc.street.number ? ` ${loc.street.number}` : ''}` : item.title;
  const price = item.totalPrice?.value ?? item.priceFromPerSquareMeter?.value ?? null;
  const sqm = item.areaInSquareMeters ?? null;
  return {
    address: street || item.title || 'Property',
    city: loc.city?.name || city || 'Unknown',
    state: loc.province?.name || state || '',
    country,
    asking_price: price != null ? Number(price) : null,
    beds: item.roomsNumber ?? null,
    baths: null,
    sqft: sqm != null ? Math.round(Number(sqm) * 10.7639) : null,
    mls_id: String(item.id),
    listing_url: imovirtualListingUrl(item),
    lat: item.location?.mapDetails?.center?.lat ?? null,
    lng: item.location?.mapDetails?.center?.lng ?? null,
    market_area: marketArea,
    source_portal: 'imovirtual',
    currency,
  };
}

function mapFincaraizItem(item, { marketArea, currency, city, state, country }) {
  const amount = item.price?.amount ?? item.price_amount_usd ?? null;
  const usdAmount = item.price_amount_usd != null ? Number(item.price_amount_usd) : null;
  const localAmount = amount != null ? Number(amount) : null;
  const asking = currency === 'USD' && usdAmount != null ? usdAmount : localAmount;
  const sqm = item.m2Built ?? item.m2 ?? null;
  return {
    address: item.address || item.title || 'Property',
    city: city || 'Unknown',
    state: state || '',
    country,
    asking_price: asking,
    beds: item.bedrooms ?? item.rooms ?? null,
    baths: item.bathrooms ?? null,
    sqft: sqm != null ? Math.round(Number(sqm) * 10.7639) : null,
    mls_id: String(item.id),
    listing_url: item.link?.startsWith('http') ? item.link : `https://www.fincaraiz.com.co${item.link}`,
    lat: item.latitude ?? null,
    lng: item.longitude ?? null,
    market_area: marketArea,
    source_portal: 'fincaraiz',
    currency,
  };
}

function mapTrivoItem(item, { marketArea, currency, city, state, country }) {
  const meta = item.meta ?? {};
  const low = meta.price ? Number(String(meta.price).replace(/[^\d.]/g, '')) : null;
  const high = meta.high_price ? Number(String(meta.high_price).replace(/[^\d.]/g, '')) : null;
  const asking = low ?? high ?? null;
  const loc = meta.location ?? {};
  return {
    address: item.title?.rendered?.replace(/&#8211;/g, '-').replace(/<[^>]+>/g, '') || 'Property',
    city: meta.city || city || 'Manta',
    state: state || 'Manabí',
    country: country || 'Ecuador',
    asking_price: asking,
    beds: null,
    baths: null,
    sqft: null,
    property_type: String(meta['property-type'] || 'condo').toLowerCase().replace(/\s+/g, '_'),
    mls_id: meta.property_id || String(item.id),
    listing_url: item.link,
    lat: loc.lat ?? null,
    lng: loc.lng ?? null,
    market_area: marketArea,
    source_portal: 'trivo',
    currency,
  };
}

async function scrapeYapaTree(url, marketArea, currency, city, state, country) {
  const html = await fetchText(url);
  const match = html.match(/astro-island[^>]*props="([^"]+)"/);
  if (!match) throw new Error('YapaTree astro props not found');

  const parsed = unwrapAstro(JSON.parse(decodeHtml(match[1])));
  const rawRows = parsed.properties?.[1] ?? parsed.properties ?? [];
  const rows = Array.isArray(rawRows) ? rawRows : [];
  const listings = [];

  for (const row of rows) {
    if (row.type !== 'for_sale' || row.published !== true) continue;
    if (String(row.status || '').toLowerCase() !== 'active') continue;
    const slug = row.urlSlug || row.slug;
    listings.push({
      address: row.fullAddress || row.name || slug || `${city} property`,
      city: city || 'Cuenca',
      state: state || 'Azuay',
      country: country || 'Ecuador',
      zip: row.zipCode || undefined,
      asking_price: row.salePriceUsd != null ? Number(row.salePriceUsd) : null,
      beds: row.bedrooms ?? null,
      baths: row.bathrooms != null ? Number(row.bathrooms) + Number(row.halfBathrooms || 0) * 0.5 : null,
      sqft: row.livingAreaM2 != null ? Math.round(Number(row.livingAreaM2) * 10.7639) : null,
      hoa_monthly: row.aliquotaUsd ?? null,
      property_type: String(row.structureType || 'other').toLowerCase().replace(/\s+/g, '_'),
      year_built: row.yearBuilt ?? null,
      mls_id: row.listingCode || row.id,
      listing_url: slug ? `${new URL(url).origin}${new URL(url).pathname.replace(/\/?$/, '/')}${slug}/` : url,
      lat: row.lat ?? null,
      lng: row.lng ?? null,
      market_area: marketArea,
      source_portal: 'yapatree',
      currency,
    });
  }
  return listings;
}

function imovirtualApiPathFromUrl(url) {
  const pathname = new URL(url).pathname.replace(/\/$/, '');
  const segments = pathname.split('/').filter(Boolean);
  // /comprar/apartamento/lisboa -> resultados/comprar/apartamento/lisboa/lisboa
  if (segments.length >= 3) {
    const city = segments[segments.length - 1];
    return `resultados/${segments.join('/')}/${city}`;
  }
  return pathname.replace(/^\//, '');
}

async function resolveImovirtualBuildId() {
  const html = await fetchText('https://www.imovirtual.com/', { 'Accept-Language': 'pt-PT,pt;q=0.9' });
  const match = html.match(/"buildId":"([^"]+)"/);
  if (!match) throw new Error('Imovirtual buildId not found');
  return match[1];
}

async function scrapeImovirtual(url, ctx) {
  let buildId;
  let apiPath;
  let firstItems = [];
  let totalPages = 1;

  try {
    const firstHtml = await fetchText(url, { 'Accept-Language': 'pt-PT,pt;q=0.9' });
    const firstData = parseNextData(firstHtml);
    buildId = firstData.buildId;
    const canonical = firstData.props.pageProps.canonicalURL || new URL(url).pathname;
    apiPath = canonical.replace(/^\/pt\//, '').replace(/^\//, '');
    firstItems = firstData.props.pageProps.data.searchAds.items ?? [];
    totalPages = firstData.props.pageProps.data.searchAds.pagination.totalPages;
  } catch (error) {
    console.warn(`  imovirtual HTML fetch failed (${error.message}); using _next/data fallback`);
    buildId = await resolveImovirtualBuildId();
    apiPath = imovirtualApiPathFromUrl(url);
    const json = JSON.parse(await fetchText(
      `https://www.imovirtual.com/_next/data/${buildId}/pt/${apiPath}.json`,
      { 'Accept-Language': 'pt-PT,pt;q=0.9', 'x-nextjs-data': '1' },
    ));
    firstItems = json.pageProps.data.searchAds.items ?? [];
    totalPages = json.pageProps.data.searchAds.pagination.totalPages;
  }

  const maxPages = ctx.maxPages ?? totalPages;
  const byId = new Map();
  const ingest = (items) => {
    for (const item of items ?? []) {
      const mapped = mapImovirtualItem(item, ctx);
      if (!mapped.listing_url || !mapped.mls_id) continue;
      byId.set(mapped.mls_id, mapped);
    }
  };

  ingest(firstItems);
  console.log(`  imovirtual page 1/${Math.min(totalPages, maxPages)} items=${firstItems.length} total=${byId.size}`);

  for (let page = 2; page <= Math.min(totalPages, maxPages); page += 1) {
    const apiUrl = `https://www.imovirtual.com/_next/data/${buildId}/pt/${apiPath}.json?page=${page}`;
    let json;
    try {
      json = JSON.parse(await fetchText(apiUrl, {
        'Accept-Language': 'pt-PT,pt;q=0.9',
        'x-nextjs-data': '1',
      }));
    } catch (error) {
      console.warn(`  imovirtual stopped at page ${page}: ${error.message}`);
      break;
    }
    const ads = json.pageProps.data.searchAds;
    ingest(ads.items);
    console.log(`  imovirtual page ${page}/${Math.min(totalPages, maxPages)} batch=${ads.items.length} total=${byId.size}`);
    if (!ads.items?.length) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return Array.from(byId.values());
}

async function scrapeFincaraiz(url, ctx) {
  const byId = new Map();
  let page = 1;
  let lastPage = 1;

  while (page <= (ctx.maxPages ?? lastPage)) {
    const pageUrl = `${url}${url.includes('?') ? '&' : '?'}page=${page}`;
    const html = await fetchText(pageUrl);
    const data = parseNextData(html);
    const searchFast = data.props.pageProps.fetchResult?.searchFast;
    if (!searchFast) throw new Error('FincaRaiz searchFast payload missing');

    lastPage = searchFast.paginatorInfo?.lastPage ?? page;
    for (const item of searchFast.data ?? []) {
      const mapped = mapFincaraizItem(item, ctx);
      if (!mapped.listing_url || !mapped.mls_id) continue;
      byId.set(mapped.mls_id, mapped);
    }
    console.log(`  fincaraiz page ${page}/${Math.min(lastPage, ctx.maxPages ?? lastPage)} batch=${searchFast.data?.length ?? 0} total=${byId.size}`);
    if (!searchFast.paginatorInfo?.hasMorePages) break;
    page += 1;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return Array.from(byId.values());
}

async function scrapeDotproperty(url, ctx) {
  const byId = new Map();
  let page = 1;
  let maxPages = ctx.maxPages ?? 999;

  while (page <= maxPages) {
    const pageUrl = page === 1 ? url : `${url}${url.includes('?') ? '&' : '?'}page=${page}`;
    const html = await fetchText(pageUrl);
    const batch = parseJsonLdItemLists(html).map((row) => ({
      ...row,
      city: ctx.city || row.city,
      state: ctx.state || '',
      country: ctx.country,
      market_area: ctx.marketArea,
      source_portal: 'dotproperty',
      currency: ctx.currency,
    }));

    if (!batch.length) break;
    for (const row of batch) {
      if (!row.listing_url || !row.mls_id) continue;
      byId.set(row.mls_id, row);
    }
    console.log(`  dotproperty page ${page} batch=${batch.length} total=${byId.size}`);

    const totalMatch = html.match(/Find (\d+) listing/i);
    const total = totalMatch ? Number(totalMatch[1]) : null;
    if (total != null && byId.size >= total) break;
    if (batch.length < 20) break;
    page += 1;
    if (ctx.maxPages == null && page > 50) break;
  }

  return Array.from(byId.values());
}

async function scrapeTrivo(cityFilter, ctx) {
  const byId = new Map();
  let page = 1;

  while (true) {
    const apiUrl = `https://www.trivo.com.ec/wp-json/wp/v2/property?per_page=100&page=${page}`;
    const response = await fetch(apiUrl, { headers: { 'User-Agent': UA } });
    if (!response.ok) break;
    const batch = await response.json();
    if (!Array.isArray(batch) || !batch.length) break;

    for (const item of batch) {
      const metaCity = (item.meta?.city || '').toLowerCase();
      if (metaCity !== cityFilter.toLowerCase()) continue;
      const mapped = mapTrivoItem(item, ctx);
      if (!mapped.listing_url || !mapped.mls_id) continue;
      byId.set(mapped.mls_id, mapped);
    }
    console.log(`  trivo page ${page} scanned=${batch.length} total=${byId.size}`);
    if (batch.length < 100) break;
    page += 1;
  }

  return Array.from(byId.values());
}

const REALTOR_GRAPHQL = `query searchListViewQuery(
  $country: String!
  $channel: String!
  $where: String
  $page: Int!
  $pageSize: Int!
  $language: String!
  $currencyCode: String
  $includesurrounding: Boolean
) {
  searchListListings(
    listingSearchInput: {
      country: $country
      channel: $channel
      where: $where
      language: $language
      currencyCode: $currencyCode
      includesurrounding: $includesurrounding
    }
    pageReq: { pageNo: $page, pageSize: $pageSize }
  ) {
    pageInfo { totalCount currentPageNo pageSize }
    listings {
      id
      sourceListingId
      displayAddress
      location { country state city postalcode }
      price(language: $language, currency: $currencyCode) {
        displayListingPrice
        hiddenPrice
      }
      bedrooms
      bathrooms
      parkingSpaces
      buildingSize(language: $language)
      propertyTypes(language: $language)
      detailPageUrl(language: $language)
      geoLocation { latitude longitude }
      country
      source
    }
  }
}`;

function parseDisplayPrice(raw, fallbackCurrency) {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  const match = cleaned.match(/(?:USD|US\$|\$)\s*([\d,]+(?:\.\d+)?)/i)
    || cleaned.match(/(?:EUR|€)\s*([\d,]+(?:\.\d+)?)/i)
    || cleaned.match(/(?:GBP|£)\s*([\d,]+(?:\.\d+)?)/i)
    || cleaned.match(/(?:HUF)\s*([\d,]+(?:\.\d+)?)/i)
    || cleaned.match(/(?:COP)\s*\$?\s*([\d,]+(?:\.\d+)?)/i)
    || cleaned.match(/(?:MXN)\s*\$?\s*([\d,]+(?:\.\d+)?)/i)
    || cleaned.match(/(?:JPY|¥)\s*([\d,]+(?:\.\d+)?)/i)
    || cleaned.match(/([\d,]+(?:\.\d+)?)/);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(value) ? value : null;
}

function parseAreaSqft(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.round(raw * 10.7639);
  const text = String(raw);
  const sqm = text.match(/([\d,.]+)\s*m²/i);
  if (sqm) return Math.round(Number(sqm[1].replace(/,/g, '')) * 10.7639);
  const sqft = text.match(/([\d,.]+)\s*sq\.?\s*ft/i);
  if (sqft) return Math.round(Number(sqft[1].replace(/,/g, '')));
  return null;
}

function normalizeListingUrl(raw) {
  if (!raw) return null;
  if (raw.startsWith('http')) {
    try {
      const url = new URL(raw);
      url.pathname = url.pathname.split('/').map((seg) => encodeURIComponent(decodeURIComponent(seg))).join('/');
      return url.toString();
    } catch {
      return raw;
    }
  }
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  const encoded = path.split('/').map((seg, i) => (i === 0 || !seg ? seg : encodeURIComponent(decodeURIComponent(seg)))).join('/');
  return `https://www.realtor.com${encoded}`;
}

function mapRealtorGraphqlListing(row, ctx) {
  const listingUrl = normalizeListingUrl(row.detailPageUrl);
  const loc = row.location ?? {};
  const city = titleCaseSlug(loc.city) || ctx.city || 'Unknown';
  const state = titleCaseSlug(loc.state) || ctx.state || '';
  const priceRaw = row.price?.hiddenPrice ? null : row.price?.displayListingPrice;
  return {
    address: row.displayAddress || `${city} property`,
    city,
    state,
    country: ctx.country,
    zip: loc.postalcode || undefined,
    asking_price: parseDisplayPrice(priceRaw, ctx.currency),
    beds: row.bedrooms ?? null,
    baths: row.bathrooms ?? null,
    sqft: parseAreaSqft(row.buildingSize),
    property_type: (row.propertyTypes?.[0] || 'other').toLowerCase().replace(/\s+/g, '_'),
    mls_id: row.sourceListingId || row.id,
    listing_url: listingUrl,
    lat: row.geoLocation?.latitude ?? null,
    lng: row.geoLocation?.longitude ?? null,
    market_area: ctx.marketArea,
    source_portal: 'realtor_international_graphql',
    currency: ctx.currency,
  };
}

async function scrapeRealtorGraphql(ctx) {
  if (!ctx.countryCode) throw new Error('realtor_graphql requires --country-code');
  const byId = new Map();
  const pageSize = 50;
  let page = 1;
  let totalCount = null;

  while (true) {
    const variables = {
      country: ctx.countryCode,
      channel: 'buy',
      where: ctx.where || undefined,
      page,
      pageSize,
      language: 'en',
      currencyCode: ctx.currency,
      includesurrounding: true,
    };

    const response = await fetch('https://www.rea.global/international/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': UA,
        Origin: 'https://www.realtor.com',
        Referer: 'https://www.realtor.com/international/',
      },
      body: JSON.stringify({
        operationName: 'searchListViewQuery',
        query: REALTOR_GRAPHQL,
        variables,
      }),
    });

    if (!response.ok) throw new Error(`Realtor GraphQL failed (${response.status})`);
    const payload = await response.json();
    if (payload.errors?.length) {
      throw new Error(payload.errors.map((e) => e.message).join('; '));
    }

    const result = payload.data?.searchListListings;
    totalCount = result?.pageInfo?.totalCount ?? totalCount;
    const batch = result?.listings ?? [];
    let added = 0;

    for (const row of batch) {
      const mapped = mapRealtorGraphqlListing(row, ctx);
      if (!mapped.listing_url || !mapped.mls_id) continue;
      if (ctx.filterCity) {
        const needle = ctx.filterCity.toLowerCase();
        const hay = `${mapped.city} ${mapped.address}`.toLowerCase();
        if (!hay.includes(needle)) continue;
      }
      if (!byId.has(String(mapped.mls_id))) {
        byId.set(String(mapped.mls_id), mapped);
        added += 1;
      }
    }

    console.log(
      `  realtor_graphql page ${page} batch=${batch.length} added=${added} total=${byId.size}${totalCount != null ? ` / ${totalCount}` : ''}`,
    );

    if (!batch.length) {
      if (page === 1) break;
      // API occasionally returns empty mid-pagination; stop if we already have data.
      break;
    }
    if (ctx.maxListings != null && byId.size >= ctx.maxListings) break;
    if (ctx.maxPages != null && page >= ctx.maxPages) break;
    if (totalCount != null && page * pageSize >= totalCount) break;
    page += 1;
    await new Promise((resolve) => setTimeout(resolve, 350));
  }

  const listings = Array.from(byId.values());
  return ctx.maxListings != null ? listings.slice(0, ctx.maxListings) : listings;
}

function mapSsgeItem(item, ctx) {
  const addr = item.address ?? {};
  const street = [addr.streetTitle, addr.streetNumber].filter(Boolean).join(' ');
  const district = [addr.districtTitle, addr.subdistrictTitle].filter(Boolean).join(', ');
  const address = street || item.title || district || 'Tbilisi property';
  const priceUsd = item.price?.priceUsd != null ? Number(item.price.priceUsd) : null;
  const sqm = item.totalArea != null ? Number(item.totalArea) : null;
  return {
    address,
    city: addr.cityTitle || ctx.city || 'Tbilisi',
    state: addr.districtTitle || ctx.state || 'Tbilisi',
    country: ctx.country || 'Georgia',
    asking_price: priceUsd,
    beds: item.numberOfBedrooms ?? null,
    baths: null,
    sqft: sqm != null ? Math.round(sqm * 10.7639) : null,
    property_type: String(item.shortTitle || 'flat').toLowerCase().replace(/\s+/g, '_'),
    mls_id: String(item.applicationId),
    listing_url: item.detailUrl?.startsWith('http')
      ? item.detailUrl
      : `https://home.ss.ge/en/real-estate/${item.detailUrl}`,
    lat: null,
    lng: null,
    market_area: ctx.marketArea,
    source_portal: 'ssge',
    currency: ctx.currency,
  };
}

async function scrapeSsge(url, ctx) {
  const byId = new Map();
  let page = 1;
  const maxPages = ctx.maxPages ?? 40;

  while (page <= maxPages) {
    const pageUrl = page === 1 ? url : `${url}${url.includes('?') ? '&' : '?'}page=${page}`;
    let html;
    try {
      html = await fetchText(pageUrl);
    } catch (error) {
      console.warn(`  ssge page ${page} fetch failed: ${error.message}; stopping with ${byId.size} listings`);
      break;
    }

    let data;
    try {
      data = parseNextData(html);
    } catch (error) {
      console.warn(`  ssge page ${page} parse failed: ${error.message}; stopping`);
      break;
    }

    const items = data.props?.pageProps?.applicationList?.realStateItemModel ?? [];
    let added = 0;

    for (const item of items) {
      const mapped = mapSsgeItem(item, ctx);
      if (!mapped.listing_url || !mapped.mls_id) continue;
      if (!byId.has(mapped.mls_id)) {
        byId.set(mapped.mls_id, mapped);
        added += 1;
      }
    }

    console.log(`  ssge page ${page} batch=${items.length} added=${added} total=${byId.size}`);
    if (!items.length || added === 0) break;
    if (ctx.maxListings != null && byId.size >= ctx.maxListings) break;
    page += 1;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const listings = Array.from(byId.values());
  return ctx.maxListings != null ? listings.slice(0, ctx.maxListings) : listings;
}

async function scrapeRealtorInternational(url, ctx) {
  const byId = new Map();
  let page = 1;
  let totalPages = ctx.maxPages ?? 999;
  let emptyStreak = 0;

  while (page <= totalPages) {
    const pageUrl = realtorPageUrl(url, page);
    const html = await fetchText(pageUrl);
    const totalMatch = html.match(/"totalCount":(\d+)/);
    if (totalMatch && ctx.maxPages == null) {
      totalPages = Math.min(Math.ceil(Number(totalMatch[1]) / 25), 200);
    }

    const batch = parseRealtorInternational(html, ctx);
    if (!batch.length) {
      emptyStreak += 1;
      console.log(`  realtor page ${page}/${totalPages} empty (streak=${emptyStreak})`);
      if (emptyStreak >= 5) break;
      page += 1;
      continue;
    }
    emptyStreak = 0;

    for (const row of batch) {
      if (!row.listing_url || !row.mls_id) continue;
      byId.set(String(row.mls_id), row);
    }
    console.log(`  realtor page ${page}/${totalPages} batch=${batch.length} total=${byId.size}`);
    if (!html.includes('standard-listing-card')) break;
    page += 1;
  }

  return Array.from(byId.values());
}

async function main() {
  const args = parseArgs(process.argv);
  const scrapedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const ctx = {
    marketArea: args.marketArea,
    currency: args.currency,
    city: args.city,
    state: args.state,
    country: args.country,
    countryCode: args.countryCode,
    where: args.where,
    filterCity: args.filterCity,
    maxPages: args.maxPages,
    maxListings: args.maxListings,
  };

  let listings;
  switch (args.source) {
    case 'yapatree':
      listings = await scrapeYapaTree(args.url, args.marketArea, args.currency, args.city, args.state, args.country);
      break;
    case 'imovirtual':
      listings = await scrapeImovirtual(args.url, ctx);
      break;
    case 'fincaraiz':
      listings = await scrapeFincaraiz(args.url, ctx);
      break;
    case 'dotproperty':
      listings = await scrapeDotproperty(args.url, ctx);
      break;
    case 'trivo':
      listings = await scrapeTrivo(args.city || 'Manta', ctx);
      break;
    case 'realtor_international':
      listings = await scrapeRealtorInternational(args.url, ctx);
      break;
    case 'realtor_graphql':
      listings = await scrapeRealtorGraphql(ctx);
      break;
    case 'ssge':
      listings = await scrapeSsge(args.url, ctx);
      break;
    default:
      throw new Error(`Unsupported source: ${args.source}`);
  }

  const payload = {
    source: args.source,
    market: args.market,
    scraped_at: scrapedAt,
    status_filter: 'active_for_sale',
    currency: args.currency,
    notes: args.notes,
    count: listings.length,
    listings,
  };

  await mkdir(dirname(args.output), { recursive: true });
  await writeFile(args.output, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
  console.log(`Wrote ${listings.length} listings to ${args.output}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
