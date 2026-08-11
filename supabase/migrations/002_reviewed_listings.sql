-- Lightweight scout-reviewed listings for baseline analytics (separate from full pipeline)

CREATE TABLE IF NOT EXISTS public.reviewed_listings (
  id text PRIMARY KEY,
  address text NOT NULL,
  city text NOT NULL,
  country text NOT NULL,
  region text,
  listing_url text NOT NULL,
  asking_price numeric NOT NULL,
  estimated_cap_rate numeric,
  rough_gross_yield numeric,
  estimated_monthly_rent numeric,
  hoa_monthly numeric,
  sqft numeric,
  beds integer,
  baths numeric,
  property_type text,
  market_id text,
  scout_decision text NOT NULL CHECK (scout_decision IN ('REJECT', 'SKIPPED')),
  notes text,
  reviewed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reviewed_listings_country_city_idx
  ON public.reviewed_listings (country, city);

CREATE INDEX IF NOT EXISTS reviewed_listings_cap_rate_idx
  ON public.reviewed_listings (estimated_cap_rate DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS reviewed_listings_market_id_idx
  ON public.reviewed_listings (market_id);

CREATE OR REPLACE FUNCTION public.set_reviewed_listings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reviewed_listings_updated_at ON public.reviewed_listings;
CREATE TRIGGER reviewed_listings_updated_at
  BEFORE UPDATE ON public.reviewed_listings
  FOR EACH ROW EXECUTE FUNCTION public.set_reviewed_listings_updated_at();

ALTER TABLE public.reviewed_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access" ON public.reviewed_listings;
CREATE POLICY "Public read access"
  ON public.reviewed_listings
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service role full access" ON public.reviewed_listings;
CREATE POLICY "Service role full access"
  ON public.reviewed_listings
  FOR ALL
  USING (auth.role() = 'service_role');
