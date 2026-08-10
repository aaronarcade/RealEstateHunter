import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildValidator,
  discoverArtifacts,
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
