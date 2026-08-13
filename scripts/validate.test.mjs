import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildValidator,
  discoverArtifacts,
  discoverReviewedListingLines,
  readJson,
} from "./lib/validator.mjs";

const { validate } = buildValidator();

test("every property artifact in the repo validates against its schema", () => {
  const artifacts = discoverArtifacts();
  assert.ok(artifacts.length > 0, "expected at least one property artifact");

  for (const artifact of artifacts) {
    const { valid, errors } = validate(artifact.schemaId, readJson(artifact.path));
    assert.ok(
      valid,
      `${artifact.property}/${artifact.file} failed: ${JSON.stringify(errors)}`,
    );
  }
});

test("field-value rejects an out-of-range status enum", () => {
  const { valid } = validate("field-value.json", {
    value: 100,
    status: "MAYBE",
    confidence: "HIGH",
  });
  assert.equal(valid, false);
});

test("evidence rejects unknown additional properties", () => {
  const { valid } = validate("property-evidence.json", {
    property_id: "x",
    researched_at: "2026-08-09T14:00:00Z",
    not_a_real_field: true,
  });
  assert.equal(valid, false);
});

test("underwriting requires a non-negative cap_rate and core fields", () => {
  const { valid } = validate("property-underwriting.json", {
    property_id: "x",
    annual_gross_rent: 26400,
    annual_operating_expenses: 12572,
    noi: 13828,
    cap_rate: -0.1,
    proposed_status: "REJECTED",
    computed_at: "2026-08-09T16:00:00Z",
  });
  assert.equal(valid, false);
});

test("meta rejects an invalid workflow_state", () => {
  const { valid } = validate("property-meta.json", {
    id: "x",
    address: "1 Test St",
    listing_url: "https://example.com/1",
    workflow_state: "NOT_A_STATE",
    created_at: "2026-08-09T12:00:00Z",
    updated_at: "2026-08-09T18:00:00Z",
  });
  assert.equal(valid, false);
});

test("meta accepts Scout screening fields", () => {
  const { valid } = validate("property-meta.json", {
    id: "test-scout-fields",
    address: "123 Condo Blvd, Tampa, FL",
    listing_url: "https://example.com/123",
    workflow_state: "SCREENED",
    scout_decision: "RESEARCH",
    property_type: "condo",
    building_name: "Bayshore Towers",
    unit: "1205",
    beds: 2,
    baths: 2,
    asking_price: 199000,
    rough_monthly_rent: 2200,
    rough_gross_yield: 0.133,
    advertised_hoa: 485,
    market_id: "tampa-fl",
    mls_id: "TB123456",
    rent_source: "Zillow estimate",
    rent_confidence: "MEDIUM",
    scout_notes: "HOA exceeds $500/mo scrutiny threshold",
    created_at: "2026-08-10T12:00:00Z",
    updated_at: "2026-08-10T12:00:00Z",
  });
  assert.equal(valid, true);
});

test("meta rejects negative asking_price", () => {
  const { valid } = validate("property-meta.json", {
    id: "x",
    address: "1 Test St",
    listing_url: "https://example.com/1",
    workflow_state: "SCREENED",
    asking_price: -50000,
    created_at: "2026-08-09T12:00:00Z",
    updated_at: "2026-08-09T18:00:00Z",
  });
  assert.equal(valid, false);
});

test("meta rejects rent_confidence outside enum", () => {
  const { valid } = validate("property-meta.json", {
    id: "x",
    address: "1 Test St",
    listing_url: "https://example.com/1",
    workflow_state: "SCREENED",
    rent_confidence: "VERY_HIGH",
    created_at: "2026-08-09T12:00:00Z",
    updated_at: "2026-08-09T18:00:00Z",
  });
  assert.equal(valid, false);
});

test("market-listing accepts new US ACTIVE market_area values", () => {
  for (const [marketArea, marketId, state] of [
    ["tampa", "tampa-fl", "FL"],
    ["jacksonville", "jacksonville-fl", "FL"],
    ["birmingham", "birmingham-al", "AL"],
    ["memphis", "memphis-tn", "TN"],
    ["cleveland", "cleveland-oh", "OH"],
  ]) {
    const { valid, errors } = validate("market-listing.json", {
      id: `sample-${marketId}`,
      address: "100 Main St Unit 1",
      city: "Sample",
      state,
      market_area: marketArea,
      market_id: marketId,
      listing_url: "https://www.redfin.com/example/home/1",
      source: "redfin",
      scrape_batch: `${marketId}-active-listings`,
      scraped_at: "2026-08-13T12:00:00Z",
      asking_price: 200000,
      beds: 2,
      baths: 2,
      property_type: "condo",
      hoa_monthly: 350,
      mls_id: "MLS1",
    });
    assert.equal(valid, true, `${marketArea}: ${JSON.stringify(errors)}`);
  }
});

test("meta rejects rough_gross_yield above 1.0", () => {
  const { valid } = validate("property-meta.json", {
    id: "x",
    address: "1 Test St",
    listing_url: "https://example.com/1",
    workflow_state: "SCREENED",
    rough_gross_yield: 1.5,
    created_at: "2026-08-09T12:00:00Z",
    updated_at: "2026-08-09T18:00:00Z",
  });
  assert.equal(valid, false);
});

test("every reviewed listing line in listings.ndjson validates", () => {
  const lines = discoverReviewedListingLines();
  assert.ok(lines.length > 0, "expected backfilled reviewed listings");

  for (const { line, lineNumber } of lines) {
    const entry = JSON.parse(line);
    const { valid, errors } = validate("reviewed-listing.json", entry);
    assert.ok(valid, `line ${lineNumber} failed: ${JSON.stringify(errors)}`);
  }
});

test("reviewed-listing rejects RESEARCH scout_decision", () => {
  const { valid } = validate("reviewed-listing.json", {
    id: "x",
    address: "1 Test St",
    city: "Tampa",
    country: "United States",
    listing_url: "https://example.com/1",
    asking_price: 100000,
    scout_decision: "RESEARCH",
    reviewed_at: "2026-08-10T12:00:00Z",
  });
  assert.equal(valid, false);
});
