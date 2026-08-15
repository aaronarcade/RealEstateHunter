#!/usr/bin/env node
// Initialize data/properties/{id}/meta.json for a new candidate.
// Usage:
//   node scripts/create-property.mjs --id <slug> --address "..." --listing-url <url> [--location "..."]
//   node scripts/create-property.mjs --address "123 Main St, Tampa, FL" --listing-url <url>
//     (id derived from address when --id omitted)
import {
  createProperty,
  generatePropertyId,
} from "./lib/property-record.mjs";

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case "--id":
        opts.id = next;
        i += 1;
        break;
      case "--address":
        opts.address = next;
        i += 1;
        break;
      case "--listing-url":
        opts.listing_url = next;
        i += 1;
        break;
      case "--location":
        opts.location = next;
        i += 1;
        break;
      case "--help":
      case "-h":
        opts.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

function usage() {
  console.log(`Usage:
  node scripts/create-property.mjs --address "..." --listing-url <url> [--id <slug>] [--location "..."]

Creates data/properties/{id}/meta.json with workflow_state=CANDIDATE.
When --id is omitted, a slug is derived from --address.`);
}

function main(argv) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    console.error(err.message);
    usage();
    return 1;
  }

  if (opts.help || argv.length === 0) {
    usage();
    return opts.help ? 0 : 1;
  }

  if (!opts.address || !opts.listing_url) {
    console.error("--address and --listing-url are required");
    usage();
    return 1;
  }

  const id = opts.id || generatePropertyId(opts.address);
  try {
    const meta = createProperty({
      id,
      address: opts.address,
      listing_url: opts.listing_url,
      location: opts.location,
    });
    console.log(`Created property ${meta.id}`);
    console.log(`  path: data/properties/${meta.id}/meta.json`);
    console.log(`  state: ${meta.workflow_state}`);
    return 0;
  } catch (err) {
    console.error(err.message);
    return 1;
  }
}

process.exit(main(process.argv.slice(2)));
