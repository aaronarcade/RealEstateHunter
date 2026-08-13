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

const laketownId = "9860-s-thomas-dr-unit-917-panama-city-beach-fl";
const laketownDir = new URL(
  `../data/properties/${laketownId}/`,
  import.meta.url,
);

test("TASK-014: Laketown Wharf evidence validates with verified rent", () => {
  const evidence = readJson(new URL("evidence.json", laketownDir));
  const { valid, errors } = validate("property-evidence.json", evidence);
  assert.ok(valid, JSON.stringify(errors));
  assert.equal(evidence.property_id, laketownId);
  assert.equal(evidence.purchase_price.value, 279000);
  assert.equal(evidence.purchase_price.status, "VERIFIED");
  assert.equal(evidence.monthly_rent.value, 4417);
  assert.equal(evidence.monthly_rent.status, "VERIFIED");
  assert.equal(evidence.monthly_rent.confidence, "HIGH");
  assert.equal(evidence.hoa_monthly.status, "ESTIMATED");
  assert.equal(evidence.special_assessments.status, "UNKNOWN");
});

test("TASK-014: Laketown Wharf underwriting NOI and sub-10% cap rate", () => {
  const underwriting = readJson(new URL("underwriting.json", laketownDir));
  const { valid, errors } = validate("property-underwriting.json", underwriting);
  assert.ok(valid, JSON.stringify(errors));
  assert.equal(underwriting.proposed_status, "REJECTED");

  const expenseSum = Object.values(underwriting.operating_expense_breakdown).reduce(
    (sum, value) => sum + value,
    0,
  );
  assert.equal(expenseSum, underwriting.annual_operating_expenses);

  const expectedNoi =
    underwriting.annual_gross_rent - underwriting.annual_operating_expenses;
  assert.equal(underwriting.noi, expectedNoi);
  assert.equal(underwriting.noi, 25080);

  const purchasePrice = underwriting.input_summary.purchase_price.value;
  assert.equal(purchasePrice, 279000);
  const expectedCapRate = underwriting.noi / purchasePrice;
  assert.ok(Math.abs(underwriting.cap_rate - expectedCapRate) < 1e-4);
  assert.ok(Math.abs(underwriting.cap_rate - 0.0899) < 1e-4);
  assert.ok(underwriting.cap_rate < 0.1);
});

test("TASK-014: Laketown Wharf audit PASS on REJECTED", () => {
  const audit = readJson(new URL("audit.json", laketownDir));
  const { valid, errors } = validate("property-audit.json", audit);
  assert.ok(valid, JSON.stringify(errors));
  assert.equal(audit.result, "PASS");
  assert.equal(audit.final_status, "REJECTED");
  assert.equal(audit.underwriter_proposed_status, "REJECTED");
  assert.ok(Array.isArray(audit.findings) && audit.findings.length >= 3);
  assert.ok(audit.findings.some((finding) => finding.field === "cap_rate"));
});

test("TASK-014: Laketown Wharf meta archived with 60-day diligence rescreen", () => {
  const meta = readJson(new URL("meta.json", laketownDir));
  const { valid, errors } = validate("property-meta.json", meta);
  assert.ok(valid, JSON.stringify(errors));
  assert.equal(meta.workflow_state, "ARCHIVED");
  assert.equal(meta.archive_reason, "audit_reject");
  assert.ok(meta.rescreen_after);
  assert.equal(meta.screening_snapshot.price, 279000);
  assert.equal(meta.screening_snapshot.rough_monthly_rent, 4417);
  assert.equal(meta.audit_summary.final_status, "REJECTED");
  assert.equal(meta.audit_summary.noi, 25080);
  assert.ok(Math.abs(meta.audit_summary.cap_rate - 0.0899) < 1e-4);

  const auditedAt = Date.parse(meta.audit_summary.audited_at);
  const rescreenAfter = Date.parse(meta.rescreen_after);
  const days = (rescreenAfter - auditedAt) / (1000 * 60 * 60 * 24);
  assert.ok(days >= 59 && days <= 61, `expected ~60 day rescreen, got ${days}`);
});
