#!/usr/bin/env node
// Validate property JSON artifacts against schemas/.
// Usage:
//   node scripts/validate-property.mjs              # all properties
//   node scripts/validate-property.mjs <property-id> # one property
import { validateProperty } from "./lib/property-record.mjs";

function main(argv) {
  const id = argv[0];
  const { failures, results, total } = validateProperty(id);

  if (total === 0) {
    console.log(
      id
        ? `No artifacts found for property: ${id}`
        : "No property artifacts found under data/properties/.",
    );
    return id ? 1 : 0;
  }

  const label = id ? `property ${id}` : "all properties";
  console.log(`Validating ${label} (${total} artifact(s)):\n`);

  for (const row of results) {
    const rel = row.file ? `${row.property}/${row.file}` : row.property;
    if (row.valid) {
      console.log(`  PASS  ${rel}  (${row.schemaId})`);
    } else {
      console.log(`  FAIL  ${rel}`);
      console.log(`        ${row.error}`);
    }
  }

  console.log(`\n${total - failures}/${total} artifact(s) valid.`);
  return failures === 0 ? 0 : 1;
}

process.exit(main(process.argv.slice(2)));
