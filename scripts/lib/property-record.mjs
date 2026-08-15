// Shared helpers for property CLI scripts (create / status / validate).
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import {
  ARTIFACT_SCHEMAS,
  buildValidator,
  formatErrors,
  propertiesDir,
  readJson,
} from "./validator.mjs";

/**
 * Slugify an address into a stable property id (max 60 chars).
 */
export function generatePropertyId(address) {
  return address
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 60);
}

/**
 * List property ids that have a meta.json (includes `_example`).
 */
export function listPropertyIds(dataDir = propertiesDir) {
  if (!existsSync(dataDir)) return [];

  return readdirSync(dataDir, { withFileTypes: true })
    .filter((entry) => {
      if (!entry.isDirectory()) return false;
      if (entry.name.startsWith(".")) return false;
      return existsSync(join(dataDir, entry.name, "meta.json"));
    })
    .map((entry) => entry.name)
    .sort();
}

export function getPropertyDir(id, dataDir = propertiesDir) {
  return join(dataDir, id);
}

export function propertyExists(id, dataDir = propertiesDir) {
  return existsSync(join(getPropertyDir(id, dataDir), "meta.json"));
}

export function readMeta(id, dataDir = propertiesDir) {
  const path = join(getPropertyDir(id, dataDir), "meta.json");
  if (!existsSync(path)) {
    throw new Error(`Property not found: ${id}`);
  }
  return readJson(path);
}

/**
 * Create a new property directory with validated meta.json.
 */
export function createProperty(
  { id, address, listing_url, location, workflow_state = "CANDIDATE" },
  dataDir = propertiesDir,
) {
  if (!id) {
    throw new Error("id is required");
  }
  if (!address) {
    throw new Error("address is required");
  }
  if (!listing_url) {
    throw new Error("listing_url is required");
  }
  if (propertyExists(id, dataDir)) {
    throw new Error(`Property already exists: ${id}`);
  }

  const now = new Date().toISOString();
  const meta = {
    id,
    address,
    listing_url,
    workflow_state,
    created_at: now,
    updated_at: now,
  };
  if (location) {
    meta.location = location;
  }

  const { validate } = buildValidator();
  const result = validate("property-meta.json", meta);
  if (!result.valid) {
    throw new Error(`Invalid meta: ${formatErrors(result.errors)}`);
  }

  const dir = getPropertyDir(id, dataDir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`);
  return meta;
}

/**
 * Validate one property's artifacts (or all when id is omitted).
 * Returns { failures, results } where results is an array of per-file outcomes.
 */
export function validateProperty(id, dataDir = propertiesDir) {
  const { validate } = buildValidator();
  const ids = id ? [id] : listPropertyIds(dataDir);
  const results = [];
  let failures = 0;

  for (const propertyId of ids) {
    const dir = getPropertyDir(propertyId, dataDir);
    if (!existsSync(dir)) {
      results.push({
        property: propertyId,
        file: null,
        valid: false,
        error: "property directory not found",
      });
      failures += 1;
      continue;
    }

    const files = readdirSync(dir).filter((f) => ARTIFACT_SCHEMAS[f]);
    if (files.length === 0) {
      results.push({
        property: propertyId,
        file: null,
        valid: false,
        error: "no schema artifacts found",
      });
      failures += 1;
      continue;
    }

    for (const file of files) {
      const schemaId = ARTIFACT_SCHEMAS[file];
      const path = join(dir, file);
      try {
        const data = JSON.parse(readFileSync(path, "utf8"));
        const result = validate(schemaId, data);
        if (result.valid) {
          results.push({ property: propertyId, file, schemaId, valid: true });
        } else {
          failures += 1;
          results.push({
            property: propertyId,
            file,
            schemaId,
            valid: false,
            error: formatErrors(result.errors),
          });
        }
      } catch (err) {
        failures += 1;
        results.push({
          property: propertyId,
          file,
          schemaId,
          valid: false,
          error: err.message,
        });
      }
    }
  }

  return { failures, results, total: results.length };
}

/**
 * Collect workflow status rows for one or all properties.
 */
export function propertyStatus(id, dataDir = propertiesDir) {
  const ids = id ? [id] : listPropertyIds(dataDir);
  return ids.map((propertyId) => {
    const meta = readMeta(propertyId, dataDir);
    return {
      id: propertyId,
      workflow_state: meta.workflow_state,
      address: meta.address,
      scout_decision: meta.scout_decision ?? null,
      updated_at: meta.updated_at,
      has_evidence: existsSync(join(getPropertyDir(propertyId, dataDir), "evidence.json")),
      has_underwriting: existsSync(
        join(getPropertyDir(propertyId, dataDir), "underwriting.json"),
      ),
      has_audit: existsSync(join(getPropertyDir(propertyId, dataDir), "audit.json")),
    };
  });
}
