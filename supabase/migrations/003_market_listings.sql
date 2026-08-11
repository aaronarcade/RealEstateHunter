-- Raw market inventory from bulk scrapes (separate from pipeline + scout-reviewed tiers)

CREATE TABLE IF NOT EXISTS public.market_listings (
  id text PRIMARY KEY,
  address text NOT NULL,
  city text NOT NULL,
  state text NOT NULL DEFAULT 'FL',
  zip text,
  market_area text NOT NULL,
  market_id text,
  asking_price numeric,
  beds integer,
  baths numeric,
  sqft numeric,
  hoa_monthly numeric,
  property_type text,
  year_built integer,
  days_on_market integer,
  mls_id text,
  listing_url text NOT NULL,
  lat numeric,
  lng numeric,
  source text NOT NULL DEFAULT 'redfin',
  scrape_batch text NOT NULL,
  scraped_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS market_listings_market_area_idx
  ON public.market_listings (market_area);

CREATE INDEX IF NOT EXISTS market_listings_city_idx
  ON public.market_listings (city);

CREATE INDEX IF NOT EXISTS market_listings_price_idx
  ON public.market_listings (asking_price);

CREATE INDEX IF NOT EXISTS market_listings_scrape_batch_idx
  ON public.market_listings (scrape_batch DESC);

CREATE INDEX IF NOT EXISTS market_listings_scraped_at_idx
  ON public.market_listings (scraped_at DESC);

CREATE OR REPLACE FUNCTION public.set_market_listings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS market_listings_updated_at ON public.market_listings;
CREATE TRIGGER market_listings_updated_at
  BEFORE UPDATE ON public.market_listings
  FOR EACH ROW EXECUTE FUNCTION public.set_market_listings_updated_at();

ALTER TABLE public.market_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access" ON public.market_listings;
CREATE POLICY "Public read access"
  ON public.market_listings
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service role full access" ON public.market_listings;
CREATE POLICY "Service role full access"
  ON public.market_listings
  FOR ALL
  USING (auth.role() = 'service_role');
