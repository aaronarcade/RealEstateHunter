import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

import {
  createProperty,
  generatePropertyId,
  listPropertyIds,
  propertyExists,
  propertyStatus,
  validateProperty,
} from "./lib/property-record.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");

function makeTempDataDir() {
  return mkdtempSync(join(tmpdir(), "reh-property-"));
}

test("generatePropertyId slugifies addresses", () => {
  assert.equal(
    generatePropertyId("123 Main St, Tampa, FL 33602"),
    "123-main-st-tampa-fl-33602",
  );
  assert.ok(generatePropertyId("A".repeat(100)).length <= 60);
});

test("createProperty writes validated meta.json", () => {
  const dataDir = makeTempDataDir();
  try {
    const meta = createProperty(
      {
        id: "test-create-prop",
        address: "1 Test Ave, Tampa, FL",
        listing_url: "https://example.com/1",
        location: "Tampa, FL",
      },
      dataDir,
    );

    assert.equal(meta.workflow_state, "CANDIDATE");
    assert.equal(meta.id, "test-create-prop");
    assert.ok(propertyExists("test-create-prop", dataDir));

    const onDisk = JSON.parse(
      readFileSync(join(dataDir, "test-create-prop", "meta.json"), "utf8"),
    );
    assert.equal(onDisk.listing_url, "https://example.com/1");
    assert.equal(onDisk.location, "Tampa, FL");
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("createProperty refuses duplicates and invalid meta", () => {
  const dataDir = makeTempDataDir();
  try {
    createProperty(
      {
        id: "dup",
        address: "2 Test Ave",
        listing_url: "https://example.com/2",
      },
      dataDir,
    );
    assert.throws(
      () =>
        createProperty(
          {
            id: "dup",
            address: "2 Test Ave",
            listing_url: "https://example.com/2",
          },
          dataDir,
        ),
      /already exists/,
    );
    assert.throws(
      () =>
        createProperty(
          {
            id: "bad-url",
            address: "3 Test Ave",
            listing_url: "not-a-url",
          },
          dataDir,
        ),
      /Invalid meta/,
    );
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("validateProperty accepts the example record", () => {
  const { failures, results } = validateProperty("_example");
  assert.ok(results.length >= 4, "example should have meta/evidence/underwriting/audit");
  assert.equal(failures, 0, JSON.stringify(results.filter((r) => !r.valid)));
});

test("validateProperty reports invalid artifacts", () => {
  const dataDir = makeTempDataDir();
  try {
    const dir = join(dataDir, "bad-meta");
    mkdirSync(dir);
    writeFileSync(
      join(dir, "meta.json"),
      JSON.stringify({
        id: "bad-meta",
        address: "9 Bad St",
        listing_url: "https://example.com/9",
        workflow_state: "NOT_A_STATE",
        created_at: "2026-08-09T12:00:00Z",
        updated_at: "2026-08-09T12:00:00Z",
      }),
    );

    const { failures, results } = validateProperty("bad-meta", dataDir);
    assert.ok(failures >= 1);
    assert.equal(results[0].valid, false);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("propertyStatus returns workflow rows for repo properties", () => {
  const rows = propertyStatus("_example");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "_example");
  assert.equal(rows[0].workflow_state, "AUDIT");
  assert.equal(rows[0].has_evidence, true);
  assert.equal(rows[0].has_underwriting, true);
  assert.equal(rows[0].has_audit, true);
});

test("listPropertyIds includes _example", () => {
  const ids = listPropertyIds();
  assert.ok(ids.includes("_example"));
});

test("CLI create-property / property-status / validate-property smoke", () => {
  const dataDir = makeTempDataDir();
  // CLIs use repo data/properties; smoke-test via helper APIs already covered.
  // Exercise the scripts against the real example property.
  const status = spawnSync(
    process.execPath,
    [join(here, "property-status.mjs"), "_example", "--json"],
    { encoding: "utf8", cwd: repoRoot },
  );
  assert.equal(status.status, 0, status.stderr);
  const parsed = JSON.parse(status.stdout);
  assert.equal(parsed[0].workflow_state, "AUDIT");

  const validate = spawnSync(
    process.execPath,
    [join(here, "validate-property.mjs"), "_example"],
    { encoding: "utf8", cwd: repoRoot },
  );
  assert.equal(validate.status, 0, validate.stderr + validate.stdout);
  assert.match(validate.stdout, /PASS/);

  // create-property against a temp dir is covered by unit tests; CLI help path:
  const help = spawnSync(
    process.execPath,
    [join(here, "create-property.mjs"), "--help"],
    { encoding: "utf8", cwd: repoRoot },
  );
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /Usage/);

  // Keep dataDir cleanup for symmetry
  assert.ok(existsSync(dataDir));
  rmSync(dataDir, { recursive: true, force: true });
});
