#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  planOnly,
  runOrchestrator,
  syncRegistryOnly,
} from "./orchestrator.js";
import { parseChangedPropertyIds } from "./repo.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function usage(): void {
  console.log(`Usage: orchestrate <command> [options]

Commands:
  plan     Show planned work items without spawning agents
  run      Sync registry, plan work, and spawn Cloud Agents
  sync     Refresh registry status from Cursor API

Options:
  --repo-root <path>    Repository root (default: parent of orchestrator/)
  --config <path>       Config file (default: <repo-root>/orchestrator.config.json)
  --dry-run             Preview spawns without calling Cursor API (run only)
  --spawn-scope <mode>  full (default) or push — push limits spawns to changed properties
  --changed-properties <ids>  Comma-separated property slugs (use with --spawn-scope push)

Environment:
  CURSOR_API_KEY        Required for run and sync
  ORCH_SPAWN_SCOPE      Optional: full | push
  ORCH_CHANGED_PROPERTIES  Optional comma-separated property ids (push scope)
`);
}

function parseArgs(argv: string[]): {
  command: string;
  repoRoot: string;
  configPath?: string;
  dryRun: boolean;
  spawnScope: "full" | "push";
  changedPropertyIds: Set<string>;
} {
  const args = [...argv];
  const command = args.shift();
  if (!command || command === "--help" || command === "-h") {
    usage();
    process.exit(command ? 0 : 1);
  }

  let repoRoot = path.resolve(__dirname, "../..");
  let configPath: string | undefined;
  let dryRun = false;
  let spawnScope: "full" | "push" =
    process.env.ORCH_SPAWN_SCOPE === "push" ? "push" : "full";
  let changedPropertyIds = parseChangedPropertyIds(
    process.env.ORCH_CHANGED_PROPERTIES
  );

  while (args.length > 0) {
    const flag = args.shift();
    if (flag === "--repo-root" && args[0]) {
      repoRoot = path.resolve(args.shift()!);
    } else if (flag === "--config" && args[0]) {
      configPath = path.resolve(args.shift()!);
    } else if (flag === "--dry-run") {
      dryRun = true;
    } else if (flag === "--spawn-scope" && args[0]) {
      const mode = args.shift()!;
      if (mode !== "full" && mode !== "push") {
        throw new Error(`Invalid --spawn-scope: ${mode}`);
      }
      spawnScope = mode;
    } else if (flag === "--changed-properties" && args[0]) {
      changedPropertyIds = parseChangedPropertyIds(args.shift());
    } else {
      throw new Error(`Unknown argument: ${flag}`);
    }
  }

  return {
    command,
    repoRoot,
    configPath,
    dryRun,
    spawnScope,
    changedPropertyIds,
  };
}

async function resolveConfigPath(
  repoRoot: string,
  configPath?: string
): Promise<string> {
  if (configPath) {
    return configPath;
  }

  const preferred = path.join(repoRoot, "orchestrator.config.json");
  try {
    await readFile(preferred, "utf8");
    return preferred;
  } catch {
    return path.join(repoRoot, "orchestrator.config.example.json");
  }
}

function printWorkItems(
  label: string,
  items: Array<{ key: string; role: string; subjectId: string; action: string; branch: string }>
): void {
  console.log(`\n${label} (${items.length})`);
  if (items.length === 0) {
    console.log("  (none)");
    return;
  }

  for (const item of items) {
    console.log(
      `  - [${item.role}] ${item.subjectId} :: ${item.action} -> ${item.branch}`
    );
    console.log(`    key: ${item.key}`);
  }
}

async function main(): Promise<void> {
  const { command, repoRoot, configPath, dryRun, spawnScope, changedPropertyIds } =
    parseArgs(process.argv.slice(2));
  const resolvedConfig = await resolveConfigPath(repoRoot, configPath);
  const apiKey = process.env.CURSOR_API_KEY;

  switch (command) {
    case "plan": {
      const planned = await planOnly(repoRoot);
      printWorkItems("Planned work", planned);
      break;
    }

    case "sync": {
      const updates = await syncRegistryOnly(repoRoot, apiKey);
      if (!apiKey) {
        console.error("CURSOR_API_KEY is required for sync.");
        process.exit(1);
      }
      console.log(`Registry synced. Updated ${updates} entr${updates === 1 ? "y" : "ies"}.`);
      break;
    }

    case "run": {
      const result = await runOrchestrator({
        repoRoot,
        configPath: resolvedConfig,
        apiKey,
        dryRun,
        spawnScope,
        changedPropertyIds,
      });

      printWorkItems("Planned work", result.planned);
      printWorkItems(
        dryRun ? "Would spawn" : "Spawned agents",
        result.spawned
      );

      if (result.skipped.length > 0) {
        console.log(`\nSkipped (${result.skipped.length})`);
        for (const skip of result.skipped.slice(0, 10)) {
          console.log(
            `  - [${skip.item.role}] ${skip.item.subjectId}: ${skip.reason}`
          );
        }
        if (result.skipped.length > 10) {
          console.log(`  ... and ${result.skipped.length - 10} more`);
        }
      }

      console.log(`\nRegistry updates this run: ${result.synced}`);
      if (dryRun) {
        console.log("Dry run only — no agents were created.");
      }
      break;
    }

    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
