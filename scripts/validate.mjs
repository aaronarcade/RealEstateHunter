#!/usr/bin/env node
// Validates every property artifact under data/properties/ against the JSON
// schemas in schemas/. Exits non-zero if any artifact fails validation.
import { relative } from "node:path";

import {
  buildValidator,
  discoverArtifacts,
  discoverReviewedListingLines,
  formatErrors,
  readJson,
  repoRoot,
} from "./lib/validator.mjs";

function main() {
  const { validate } = buildValidator();
  const artifacts = discoverArtifacts();

  if (artifacts.length === 0) {
    console.log("No property artifacts found under data/properties/.");
    return 0;
  }

  let failures = 0;
  console.log(`Validating ${artifacts.length} property artifact(s):\n`);

  for (const artifact of artifacts) {
    const rel = relative(repoRoot, artifact.path);
    let result;
    try {
      result = validate(artifact.schemaId, readJson(artifact.path));
    } catch (err) {
      failures += 1;
      console.log(`  FAIL  ${rel}\n        could not parse: ${err.message}`);
      continue;
    }

    if (result.valid) {
      console.log(`  PASS  ${rel}  (${artifact.schemaId})`);
    } else {
      failures += 1;
      console.log(`  FAIL  ${rel}  (${artifact.schemaId})`);
      console.log(`        ${formatErrors(result.errors)}`);
    }
  }

  console.log(
    `\n${artifacts.length - failures}/${artifacts.length} property artifact(s) valid.`,
  );

  const reviewedLines = discoverReviewedListingLines();
  if (reviewedLines.length > 0) {
    console.log(`\nValidating ${reviewedLines.length} reviewed listing line(s):\n`);
    for (const { line, lineNumber } of reviewedLines) {
      const rel = `data/reviewed/listings.ndjson:${lineNumber}`;
      let entry;
      try {
        entry = JSON.parse(line);
      } catch (err) {
        failures += 1;
        console.log(`  FAIL  ${rel}\n        could not parse: ${err.message}`);
        continue;
      }

      const result = validate("reviewed-listing.json", entry);
      if (result.valid) {
        console.log(`  PASS  ${rel}  (reviewed-listing.json)`);
      } else {
        failures += 1;
        console.log(`  FAIL  ${rel}  (reviewed-listing.json)`);
        console.log(`        ${formatErrors(result.errors)}`);
      }
    }
  }

  return failures === 0 ? 0 : 1;
}

process.exit(main());
