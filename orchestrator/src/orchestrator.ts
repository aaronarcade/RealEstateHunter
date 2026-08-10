import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  CursorCloudClient,
  countActiveForRole,
  isRoleEnabled,
  loadConfig,
  roleHasCapacity,
  type OrchestratorConfig,
} from "./cursor-client.js";
import { planWork, type WorkItem } from "./planner.js";
import {
  activeRegistryEntries,
  hasActiveWork,
  loadActiveTaskIds,
  loadBuilderTasks,
  loadPropertyContexts,
  loadRegistry,
  repoPaths,
  saveRegistry,
  shouldRunManagerTriage,
  type Registry,
  type RegistryEntry,
  type RegistryEntryStatus,
} from "./repo.js";

export interface OrchestratorOptions {
  repoRoot: string;
  configPath: string;
  apiKey?: string;
  dryRun?: boolean;
}

export interface OrchestratorResult {
  planned: WorkItem[];
  spawned: WorkItem[];
  skipped: Array<{ item: WorkItem; reason: string }>;
  synced: number;
}

export async function runOrchestrator(
  options: OrchestratorOptions
): Promise<OrchestratorResult> {
  const paths = repoPaths(options.repoRoot);
  const configRaw = await readFile(options.configPath, "utf8");
  const config = loadConfig(options.configPath, configRaw);

  const registry = await loadRegistry(paths.registryPath);
  const synced = await syncRegistry(registry, options.apiKey, paths.registryPath);

  const activeTaskIds = await loadActiveTaskIds(paths.tasksActiveDir);
  const activeRegistry = activeRegistryEntries(registry);

  const properties = await loadPropertyContexts(paths.propertiesDir);
  const builderTasks = await loadBuilderTasks(
    paths.tasksBacklogDir,
    paths.tasksActiveDir,
    new Set([
      ...activeTaskIds,
      ...activeRegistry
        .filter((entry) => entry.subjectType === "task")
        .map((entry) => entry.subjectId),
    ])
  );

  const planned = planWork({
    properties,
    builderTasks,
    pendingManagerReview: shouldRunManagerTriage(properties, builderTasks),
  });

  const filtered = planned.filter((item) => {
    if (!isRoleEnabled(config, item.role)) {
      return false;
    }
    if (hasActiveWork(registry, item.key)) {
      return false;
    }
    if (
      !roleHasCapacity(
        config,
        item.role,
        countActiveForRole(activeRegistry, item.role)
      )
    ) {
      return false;
    }
    if (activeRegistry.length >= config.maxConcurrentAgents) {
      return false;
    }
    return true;
  });

  const spawnBudget = Math.max(
    0,
    config.maxConcurrentAgents - activeRegistry.length
  );
  const toSpawn = filtered.slice(0, spawnBudget);

  const skipped = planned
    .filter((item) => !toSpawn.includes(item))
    .map((item) => ({
      item,
      reason: skipReason(item, registry, config, activeRegistry),
    }));

  const spawned: WorkItem[] = [];

  if (!options.dryRun) {
    if (!options.apiKey) {
      throw new Error(
        "CURSOR_API_KEY is required to spawn agents. Use --dry-run to preview only."
      );
    }

    const client = new CursorCloudClient(options.apiKey);

    for (const item of toSpawn) {
      const created = await client.createAgent(config, {
        promptText: item.prompt,
        branch: item.branch,
        name: `${item.role}: ${item.subjectId}`,
        autoCreatePR: config.autoCreatePR,
        skipReviewerRequest: config.skipReviewerRequest,
      });

      const now = new Date().toISOString();
      registry.entries[item.key] = {
        workKey: item.key,
        role: item.role,
        subjectType: item.subjectType,
        subjectId: item.subjectId,
        action: item.action,
        branch: item.branch,
        agentId: created.agentId,
        runId: created.runId,
        agentUrl: created.agentUrl,
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      };
      spawned.push(item);
    }

    if (spawned.length > 0) {
      await saveRegistry(paths.registryPath, registry);
    }
  }

  return {
    planned,
    spawned: options.dryRun ? toSpawn : spawned,
    skipped,
    synced,
  };
}

export async function syncRegistryOnly(
  repoRoot: string,
  apiKey?: string
): Promise<number> {
  const paths = repoPaths(repoRoot);
  const registry = await loadRegistry(paths.registryPath);
  return syncRegistry(registry, apiKey, paths.registryPath);
}

async function syncRegistry(
  registry: Registry,
  apiKey: string | undefined,
  registryPath: string
): Promise<number> {
  if (!apiKey) {
    return 0;
  }

  const client = new CursorCloudClient(apiKey);
  let updates = 0;

  for (const entry of Object.values(registry.entries)) {
    if (entry.status !== "ACTIVE") {
      continue;
    }

    try {
      const agent = await client.getAgent(entry.agentId);
      let runStatus: RegistryEntryStatus = entry.status;

      if (agent.latestRunId) {
        const run = await client.getRun(agent.latestRunId);
        runStatus = mapRunStatus(run.status);
      }

      const nextStatus = terminalStatus(runStatus);
      if (nextStatus && nextStatus !== entry.status) {
        entry.status = nextStatus;
        entry.updatedAt = new Date().toISOString();
        updates += 1;
      }
    } catch {
      entry.status = "ERROR";
      entry.updatedAt = new Date().toISOString();
      updates += 1;
    }
  }

  if (updates > 0) {
    await saveRegistry(registryPath, registry);
  }

  return updates;
}

function mapRunStatus(status: string): RegistryEntry["status"] {
  switch (status.toUpperCase()) {
    case "FINISHED":
      return "FINISHED";
    case "FAILED":
    case "ERROR":
      return "ERROR";
    case "CANCELLED":
      return "CANCELLED";
    default:
      return "ACTIVE";
  }
}

function terminalStatus(
  status: RegistryEntry["status"]
): RegistryEntry["status"] | undefined {
  if (status === "ACTIVE") {
    return undefined;
  }
  return status;
}

function skipReason(
  item: WorkItem,
  registry: Registry,
  config: OrchestratorConfig,
  activeRegistry: RegistryEntry[]
): string {
  if (!isRoleEnabled(config, item.role)) {
    return "role disabled in config";
  }
  if (hasActiveWork(registry, item.key)) {
    return "work item already active";
  }
  if (
    !roleHasCapacity(
      config,
      item.role,
      countActiveForRole(activeRegistry, item.role)
    )
  ) {
    return "role at max concurrency";
  }
  if (activeRegistry.length >= config.maxConcurrentAgents) {
    return "global max concurrent agents reached";
  }
  return "lower priority or spawn budget exhausted";
}

export async function planOnly(repoRoot: string): Promise<WorkItem[]> {
  const paths = repoPaths(repoRoot);
  const registry = await loadRegistry(paths.registryPath);
  const activeRegistry = activeRegistryEntries(registry);
  const activeTaskIds = await loadActiveTaskIds(paths.tasksActiveDir);

  const properties = await loadPropertyContexts(paths.propertiesDir);
  const builderTasks = await loadBuilderTasks(
    paths.tasksBacklogDir,
    paths.tasksActiveDir,
    new Set([
      ...activeTaskIds,
      ...activeRegistry
        .filter((entry) => entry.subjectType === "task")
        .map((entry) => entry.subjectId),
    ])
  );

  return planWork({
    properties,
    builderTasks,
    pendingManagerReview: shouldRunManagerTriage(properties, builderTasks),
  });
}

export function findRepoRoot(startDir: string): string {
  return path.resolve(startDir);
}
