#!/usr/bin/env node
// Show workflow state for one or all properties.
// Usage:
//   node scripts/property-status.mjs
//   node scripts/property-status.mjs <property-id>
//   node scripts/property-status.mjs --json
import { propertyStatus } from "./lib/property-record.mjs";

function parseArgs(argv) {
  const opts = { json: false, id: undefined };
  for (const arg of argv) {
    if (arg === "--json" || arg === "-j") {
      opts.json = true;
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown flag: ${arg}`);
    } else if (opts.id) {
      throw new Error("Only one property id is allowed");
    } else {
      opts.id = arg;
    }
  }
  return opts;
}

function formatRow(row) {
  const flags = [
    row.has_evidence ? "E" : "-",
    row.has_underwriting ? "U" : "-",
    row.has_audit ? "A" : "-",
  ].join("");
  const scout = row.scout_decision ? ` scout=${row.scout_decision}` : "";
  return `${row.workflow_state.padEnd(22)} ${flags}  ${row.id}${scout}`;
}

function main(argv) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    console.error(err.message);
    console.error("Usage: node scripts/property-status.mjs [--json] [property-id]");
    return 1;
  }

  let rows;
  try {
    rows = propertyStatus(opts.id);
  } catch (err) {
    console.error(err.message);
    return 1;
  }

  if (rows.length === 0) {
    console.log(
      opts.id
        ? `Property not found: ${opts.id}`
        : "No properties found under data/properties/.",
    );
    return opts.id ? 1 : 0;
  }

  if (opts.json) {
    console.log(JSON.stringify(rows, null, 2));
    return 0;
  }

  console.log("state                  EUA  id");
  console.log("-".repeat(60));
  for (const row of rows) {
    console.log(formatRow(row));
  }
  console.log(`\n${rows.length} property(ies). E=evidence U=underwriting A=audit`);
  return 0;
}

process.exit(main(process.argv.slice(2)));
