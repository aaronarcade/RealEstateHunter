#!/usr/bin/env node
// Validates every property artifact under data/properties/ against the JSON
// schemas in schemas/. Exits non-zero if any artifact fails validation.
import { relative } from "node:path";

import {
  buildValidator,
  discoverArtifacts,
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
    `\n${artifacts.length - failures}/${artifacts.length} artifact(s) valid.`,
  );
  return failures === 0 ? 0 : 1;
}

process.exit(main());
