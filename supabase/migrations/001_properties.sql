-- RealEstateHunter published opportunities (UI runtime store)
-- Coexists with RealEstateTracker tables in the same Supabase project.

CREATE TABLE IF NOT EXISTS public.properties (
  id text PRIMARY KEY,
  address text NOT NULL,
  location text NOT NULL,
  listing_url text NOT NULL,
  purchase_price jsonb NOT NULL,
  monthly_rent jsonb NOT NULL,
  annual_gross_rent numeric NOT NULL,
  annual_operating_expenses numeric NOT NULL,
  noi numeric NOT NULL,
  cap_rate numeric NOT NULL,
  hoa jsonb NOT NULL,
  assessment jsonb NOT NULL,
  confidence text NOT NULL CHECK (confidence IN ('HIGH', 'MEDIUM', 'LOW')),
  status text NOT NULL CHECK (status IN ('VIABLE', 'WATCHLIST', 'REJECTED')),
  workflow_state text NOT NULL DEFAULT 'PUBLISHED',
  sources jsonb,
  ranked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS properties_status_idx ON public.properties (status);
CREATE INDEX IF NOT EXISTS properties_cap_rate_idx ON public.properties (cap_rate DESC);
CREATE INDEX IF NOT EXISTS properties_workflow_state_idx ON public.properties (workflow_state);

CREATE OR REPLACE FUNCTION public.set_properties_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS properties_updated_at ON public.properties;
CREATE TRIGGER properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.set_properties_updated_at();

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access" ON public.properties;
CREATE POLICY "Public read access"
  ON public.properties
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service role full access" ON public.properties;
CREATE POLICY "Service role full access"
  ON public.properties
  FOR ALL
  USING (auth.role() = 'service_role');
