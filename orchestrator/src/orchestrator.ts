import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  CursorCloudClient,
  countActiveForRole,
  directMainPushInstructions,
  isRoleEnabled,
  loadConfig,
  resolveAgentBranch,
  resolveRoleAutoCreatePR,
  resolveRoleSkipReviewerRequest,
  roleHasCapacity,
  type OrchestratorConfig,
} from "./cursor-client.js";
import { planWork, type WorkItem } from "./planner.js";
import {
  activeRegistryEntries,
  getUsActiveMarketIds,
  hasActiveWork,
  hasInFlightWork,
  loadActiveTaskIds,
  loadBuilderTasks,
  loadPipelineStatus,
  loadPropertyContexts,
  loadRegistry,
  loadScoutTasks,
  loadSearchCriteria,
  repoPaths,
  saveRegistry,
  shouldDeferInternationalRoles,
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
  /** full = plan everything; push = only next step for changed properties */
  spawnScope?: "full" | "push";
  changedPropertyIds?: Set<string>;
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
  const registryTaskIds = new Set(
    activeRegistry
      .filter((entry) => entry.subjectType === "task")
      .map((entry) => entry.subjectId)
  );
  const builderInFlightTaskIds = new Set([
    ...activeTaskIds,
    ...registryTaskIds,
  ]);

  const properties = await loadPropertyContexts(paths.propertiesDir);
  const builderTasks = await loadBuilderTasks(
    paths.tasksBacklogDir,
    paths.tasksActiveDir,
    builderInFlightTaskIds
  );
  const scoutTasks = await loadScoutTasks(
    paths.tasksActiveDir,
    paths.tasksBacklogDir,
    registryTaskIds
  );

  const searchCriteria = await loadSearchCriteria(
    path.join(
      options.repoRoot,
      config.manager?.scanCriteriaFile ?? "data/search-criteria.json"
    )
  );
  const pipelineStatus = await loadPipelineStatus(
    path.join(options.repoRoot, "data/pipeline-status.json")
  );
  const deferInternational = shouldDeferInternationalRoles(
    searchCriteria,
    pipelineStatus
  );
  const usActiveMarketIds = getUsActiveMarketIds(searchCriteria);

  const planned = planWork({
    properties,
    builderTasks,
    scoutTasks,
    deferInternational,
    usActiveMarketIds,
    pendingManagerReview: shouldRunManagerTriage(properties, builderTasks),
  });

  const scopedPlanned = applySpawnScope(
    planned,
    options.spawnScope ?? "full",
    options.changedPropertyIds
  );

  const filtered = scopedPlanned.filter((item) => {
    if (!isRoleEnabled(config, item.role)) {
      return false;
    }
    if (hasActiveWork(registry, item.key)) {
      return false;
    }
    if (
      hasInFlightWork(
        registry,
        item.role,
        item.subjectType,
        item.subjectId
      )
    ) {
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

  const skipped = scopedPlanned
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
      const autoCreatePR = resolveRoleAutoCreatePR(config, item.role);
      const branch = resolveAgentBranch(config, item.role, item.branch);
      const promptText = autoCreatePR
        ? item.prompt
        : item.prompt + directMainPushInstructions(config);

      const created = await client.createAgent(config, {
        promptText,
        branch,
        name: `${item.role}: ${item.subjectId}`,
        autoCreatePR,
        skipReviewerRequest: resolveRoleSkipReviewerRequest(
          config,
          item.role
        ),
      });

      const now = new Date().toISOString();
      registry.entries[item.key] = {
        workKey: item.key,
        role: item.role,
        subjectType: item.subjectType,
        subjectId: item.subjectId,
        action: item.action,
        branch,
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
    planned: scopedPlanned,
    spawned: options.dryRun ? toSpawn : spawned,
    skipped,
    synced,
  };
}

/** Push-triggered runs: advance only properties touched by the merge, not the whole backlog. */
function applySpawnScope(
  planned: WorkItem[],
  spawnScope: "full" | "push",
  changedPropertyIds?: Set<string>
): WorkItem[] {
  if (spawnScope !== "push") {
    return planned;
  }
  if (!changedPropertyIds || changedPropertyIds.size === 0) {
    return [];
  }
  return planned.filter(
    (item) =>
      item.subjectType === "property" &&
      changedPropertyIds.has(item.subjectId)
  );
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
    hasInFlightWork(
      registry,
      item.role,
      item.subjectType,
      item.subjectId
    )
  ) {
    return "agent in flight for this subject (running or recent PR pending)";
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

export async function planOnly(
  repoRoot: string,
  configPath?: string
): Promise<WorkItem[]> {
  const paths = repoPaths(repoRoot);
  const registry = await loadRegistry(paths.registryPath);
  const activeRegistry = activeRegistryEntries(registry);
  const activeTaskIds = await loadActiveTaskIds(paths.tasksActiveDir);
  const registryTaskIds = new Set(
    activeRegistry
      .filter((entry) => entry.subjectType === "task")
      .map((entry) => entry.subjectId)
  );
  const builderInFlightTaskIds = new Set([
    ...activeTaskIds,
    ...registryTaskIds,
  ]);

  const properties = await loadPropertyContexts(paths.propertiesDir);
  const builderTasks = await loadBuilderTasks(
    paths.tasksBacklogDir,
    paths.tasksActiveDir,
    builderInFlightTaskIds
  );
  const scoutTasks = await loadScoutTasks(
    paths.tasksActiveDir,
    paths.tasksBacklogDir,
    registryTaskIds
  );

  let scanCriteriaFile = "data/search-criteria.json";
  if (configPath) {
    try {
      const configRaw = await readFile(configPath, "utf8");
      const config = loadConfig(configPath, configRaw);
      scanCriteriaFile =
        config.manager?.scanCriteriaFile ?? scanCriteriaFile;
    } catch {
      // use default
    }
  }

  const searchCriteria = await loadSearchCriteria(
    path.join(repoRoot, scanCriteriaFile)
  );
  const pipelineStatus = await loadPipelineStatus(
    path.join(repoRoot, "data/pipeline-status.json")
  );

  return planWork({
    properties,
    builderTasks,
    scoutTasks,
    deferInternational: shouldDeferInternationalRoles(
      searchCriteria,
      pipelineStatus
    ),
    usActiveMarketIds: getUsActiveMarketIds(searchCriteria),
    pendingManagerReview: shouldRunManagerTriage(properties, builderTasks),
  });
}

export function findRepoRoot(startDir: string): string {
  return path.resolve(startDir);
}
