import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import Ajv from "ajv";
import addFormats from "ajv-formats";

const here = dirname(fileURLToPath(import.meta.url));
export const repoRoot = join(here, "..", "..");
export const schemasDir = join(repoRoot, "schemas");
export const propertiesDir = join(repoRoot, "data", "properties");
export const reviewedListingsFile = join(repoRoot, "data", "reviewed", "listings.ndjson");

// Maps each per-property artifact filename to the schema ($id) that validates it.
export const ARTIFACT_SCHEMAS = {
  "meta.json": "property-meta.json",
  "evidence.json": "property-evidence.json",
  "underwriting.json": "property-underwriting.json",
  "audit.json": "property-audit.json",
};

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

// Builds an Ajv instance with every schema registered so that cross-schema
// `$ref`s (e.g. field-value.json) resolve during compilation.
export function buildValidator() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);

  for (const file of readdirSync(schemasDir)) {
    if (file.endsWith(".json")) {
      ajv.addSchema(readJson(join(schemasDir, file)));
    }
  }

  function validate(schemaId, data) {
    const validateFn = ajv.getSchema(schemaId);
    if (!validateFn) {
      throw new Error(`Unknown schema: ${schemaId}`);
    }
    const valid = validateFn(data);
    return { valid, errors: valid ? [] : validateFn.errors ?? [] };
  }

  return { ajv, validate };
}

// Discovers every per-property artifact under data/properties/<id>/ and pairs it
// with its schema. Skips bookkeeping files like .gitkeep and README.md.
export function discoverArtifacts() {
  const artifacts = [];
  let entries;
  try {
    entries = readdirSync(propertiesDir, { withFileTypes: true });
  } catch {
    return artifacts;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const propertyDir = join(propertiesDir, entry.name);
    for (const file of readdirSync(propertyDir)) {
      const schemaId = ARTIFACT_SCHEMAS[file];
      if (!schemaId) continue;
      artifacts.push({
        property: entry.name,
        file,
        schemaId,
        path: join(propertyDir, file),
      });
    }
  }

  return artifacts;
}

export function discoverReviewedListingLines() {
  if (!existsSync(reviewedListingsFile)) {
    return [];
  }

  const content = readFileSync(reviewedListingsFile, "utf8").trim();
  if (!content) {
    return [];
  }

  return content
    .split("\n")
    .map((line, index) => ({ line: line.trim(), lineNumber: index + 1 }))
    .filter(({ line }) => line.length > 0);
}

export function formatErrors(errors) {
  return errors
    .map((e) => `${e.instancePath || "(root)"} ${e.message}`)
    .join("; ");
}

export { readJson };
