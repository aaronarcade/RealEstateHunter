import { readdir, readFile, access, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type {
  BuilderTask,
  PropertyAudit,
  PropertyContext,
  PropertyMeta,
  ScoutTask,
} from "./planner.js";

export interface SearchCriteria {
  markets?: Array<{ id: string; status?: string }>;
  scout_instructions?: {
    volume_targets?: {
      defer_international_until_us_targets_met?: boolean;
      research_candidates_per_market_min?: number;
    };
    market_sweep_order?: string[];
  };
}

export interface PipelineStatus {
  volume_targets?: {
    research_candidates_per_market_min?: number;
  };
  market_coverage?: Array<{
    market_id: string;
    status?: string;
    research_candidates_open?: number;
  }>;
  scout_next_actions?: string[];
}

const EXCLUDED_PROPERTY_DIRS = new Set(["_example"]);

export interface RepoPaths {
  root: string;
  propertiesDir: string;
  tasksBacklogDir: string;
  tasksActiveDir: string;
  registryPath: string;
}

export function repoPaths(root: string): RepoPaths {
  return {
    root,
    propertiesDir: path.join(root, "data", "properties"),
    tasksBacklogDir: path.join(root, "tasks", "backlog"),
    tasksActiveDir: path.join(root, "tasks", "active"),
    registryPath: path.join(root, "data", "orchestrator", "registry.json"),
  };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson<T>(filePath: string): Promise<T | undefined> {
  if (!(await fileExists(filePath))) {
    return undefined;
  }
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

export async function loadPropertyContexts(
  propertiesDir: string
): Promise<PropertyContext[]> {
  let entries: string[] = [];
  try {
    entries = await readdir(propertiesDir);
  } catch {
    return [];
  }

  const contexts: PropertyContext[] = [];

  for (const entry of entries) {
    if (EXCLUDED_PROPERTY_DIRS.has(entry)) {
      continue;
    }

    const propertyDir = path.join(propertiesDir, entry);
    const metaPath = path.join(propertyDir, "meta.json");
    if (!(await fileExists(metaPath))) {
      continue;
    }

    const meta = (await readJson<PropertyMeta>(metaPath)) ?? {
      id: entry,
      workflow_state: "CANDIDATE",
    };

    contexts.push({
      propertyId: meta.id ?? entry,
      meta,
      hasEvidence: await fileExists(path.join(propertyDir, "evidence.json")),
      hasUnderwriting: await fileExists(
        path.join(propertyDir, "underwriting.json")
      ),
      hasAudit: await fileExists(path.join(propertyDir, "audit.json")),
      audit: await readJson<PropertyAudit>(path.join(propertyDir, "audit.json")),
    });
  }

  return contexts;
}

export async function loadBuilderTasks(
  backlogDir: string,
  activeDir: string,
  activeTaskIds: Set<string>
): Promise<BuilderTask[]> {
  let backlogEntries: string[] = [];
  try {
    backlogEntries = await readdir(backlogDir);
  } catch {
    return [];
  }

  const tasks: BuilderTask[] = [];

  for (const fileName of backlogEntries) {
    if (!fileName.endsWith(".md")) {
      continue;
    }

    const match = /^TASK-(\d+)-(.+)\.md$/.exec(fileName);
    if (!match) {
      continue;
    }

    const taskId = `TASK-${match[1]}`;
    if (activeTaskIds.has(taskId)) {
      continue;
    }

    const content = await readFile(path.join(backlogDir, fileName), "utf8");
    if (!isBuilderAssignableTask(content)) {
      continue;
    }

    tasks.push({
      taskId,
      slug: match[2],
      filePath: path.join("tasks", "backlog", fileName),
      priority: readTaskPriorityFromContent(content),
    });
  }

  // Stable ordering: lower TASK number first within same priority
  return tasks.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.taskId.localeCompare(b.taskId);
  });
}

export async function loadScoutTasks(
  activeDir: string,
  backlogDir: string,
  inFlightTaskIds: Set<string>
): Promise<ScoutTask[]> {
  const tasks: ScoutTask[] = [];
  const seen = new Set<string>();

  for (const [dir, dirLabel] of [
    [activeDir, "active"],
    [backlogDir, "backlog"],
  ] as const) {
    let entries: string[] = [];
    try {
      entries = await readdir(dir);
    } catch {
      continue;
    }

    for (const fileName of entries) {
      if (!fileName.endsWith(".md")) {
        continue;
      }

      const match = /^TASK-(\d+)-(.+)\.md$/.exec(fileName);
      if (!match) {
        continue;
      }

      const taskId = `TASK-${match[1]}`;
      if (seen.has(taskId) || inFlightTaskIds.has(taskId)) {
        continue;
      }

      const content = await readFile(path.join(dir, fileName), "utf8");
      if (!isScoutAssignableTask(content)) {
        continue;
      }

      seen.add(taskId);
      tasks.push({
        taskId,
        slug: match[2],
        filePath: path.join("tasks", dirLabel, fileName),
        priority: readTaskPriorityFromContent(content),
      });
    }
  }

  return tasks.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.taskId.localeCompare(b.taskId);
  });
}

/**
 * Active/backlog tasks assigned to Scout (e.g. TASK-009 market sweep).
 */
export function isScoutAssignableTask(taskMarkdown: string): boolean {
  const assigneeMatch = /^\*\*Assignee:\*\*\s*(.+)$/m.exec(taskMarkdown);
  if (!assigneeMatch) {
    return false;
  }
  return /\bscout\b/i.test(assigneeMatch[1].trim());
}

export async function loadSearchCriteria(
  criteriaPath: string
): Promise<SearchCriteria> {
  return (await readJson<SearchCriteria>(criteriaPath)) ?? {};
}

export async function loadPipelineStatus(
  statusPath: string
): Promise<PipelineStatus | undefined> {
  return readJson<PipelineStatus>(statusPath);
}

/** US ACTIVE markets: union of market_sweep_order and markets with status ACTIVE. */
export function getUsActiveMarketIds(criteria: SearchCriteria): Set<string> {
  const fromMarkets = (criteria.markets ?? [])
    .filter((market) => market.status === "ACTIVE")
    .map((market) => market.id);
  const sweepOrder = criteria.scout_instructions?.market_sweep_order ?? [];
  return new Set([...fromMarkets, ...sweepOrder]);
}

export function shouldDeferInternationalRoles(
  criteria: SearchCriteria,
  pipelineStatus?: PipelineStatus
): boolean {
  const deferFlag =
    criteria.scout_instructions?.volume_targets
      ?.defer_international_until_us_targets_met ?? false;

  if (!deferFlag && !pipelineIndicatesDefer(pipelineStatus)) {
    return false;
  }

  if (areUsVolumeTargetsMet(criteria, pipelineStatus)) {
    return false;
  }

  return true;
}

function pipelineIndicatesDefer(status?: PipelineStatus): boolean {
  if (!status) {
    return false;
  }
  if (
    status.scout_next_actions?.some((action) =>
      /defer.*international/i.test(action)
    )
  ) {
    return true;
  }
  return hasActiveMarketVolumeGaps(status);
}

function hasActiveMarketVolumeGaps(status: PipelineStatus): boolean {
  const perMarketMin =
    status.volume_targets?.research_candidates_per_market_min ?? 3;
  return (status.market_coverage ?? [])
    .filter((market) => market.status === "ACTIVE")
    .some(
      (market) => (market.research_candidates_open ?? 0) < perMarketMin
    );
}

function areUsVolumeTargetsMet(
  criteria: SearchCriteria,
  status?: PipelineStatus
): boolean {
  const perMarketMin =
    criteria.scout_instructions?.volume_targets
      ?.research_candidates_per_market_min ??
    status?.volume_targets?.research_candidates_per_market_min ??
    3;

  const activeMarketIds = (criteria.markets ?? [])
    .filter((market) => market.status === "ACTIVE")
    .map((market) => market.id);
  const marketIds =
    activeMarketIds.length > 0
      ? activeMarketIds
      : (criteria.scout_instructions?.market_sweep_order ?? []);

  if (marketIds.length === 0 || !status?.market_coverage) {
    return false;
  }

  return marketIds.every((marketId) => {
    const coverage = status.market_coverage!.find(
      (market) => market.market_id === marketId
    );
    return (coverage?.research_candidates_open ?? 0) >= perMarketMin;
  });
}

/**
 * Backlog may hold parked Analyst/Scout/Auditor tracking tasks.
 * Only spawn Builder when Assignee is missing (default Builder) or mentions Builder.
 */
export function isBuilderAssignableTask(taskMarkdown: string): boolean {
  const assigneeMatch = /^\*\*Assignee:\*\*\s*(.+)$/m.exec(taskMarkdown);
  if (!assigneeMatch) {
    return true;
  }
  const assignee = assigneeMatch[1].trim();
  return /\bbuilder\b/i.test(assignee);
}

function readTaskPriorityFromContent(content: string): number {
  if (/^\*\*Priority:\*\*\s*P0/m.test(content)) {
    return 1;
  }
  if (/^\*\*Priority:\*\*\s*P1/m.test(content)) {
    return 10;
  }
  if (/^\*\*Priority:\*\*\s*P2/m.test(content)) {
    return 20;
  }
  return 15;
}

export async function loadActiveTaskIds(activeDir: string): Promise<Set<string>> {
  let entries: string[] = [];
  try {
    entries = await readdir(activeDir);
  } catch {
    return new Set();
  }

  const ids = new Set<string>();
  for (const fileName of entries) {
    const match = /^(TASK-\d+)-/.exec(fileName);
    if (match) {
      ids.add(match[1]);
    }
  }
  return ids;
}

export function shouldRunManagerTriage(
  properties: PropertyContext[],
  builderTasks: BuilderTask[]
): boolean {
  const needsAttention = properties.some((property) =>
    ["CANDIDATE", "RANKED"].includes(property.meta.workflow_state)
  );
  return needsAttention || builderTasks.length > 0;
}

export type RegistryEntryStatus =
  | "ACTIVE"
  | "FINISHED"
  | "ERROR"
  | "CANCELLED";

export interface RegistryEntry {
  workKey: string;
  role: string;
  subjectType: string;
  subjectId: string;
  action: string;
  branch: string;
  agentId: string;
  runId?: string;
  agentUrl?: string;
  status: RegistryEntryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Registry {
  version: 1;
  entries: Record<string, RegistryEntry>;
}

export async function loadRegistry(registryPath: string): Promise<Registry> {
  const existing = await readJson<Registry>(registryPath);
  if (existing?.version === 1) {
    return existing;
  }
  return { version: 1, entries: {} };
}

export async function saveRegistry(
  registryPath: string,
  registry: Registry
): Promise<void> {
  await mkdir(path.dirname(registryPath), { recursive: true });
  await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
}

export function activeRegistryEntries(registry: Registry): RegistryEntry[] {
  return Object.values(registry.entries).filter(
    (entry) => entry.status === "ACTIVE"
  );
}

export function hasActiveWork(registry: Registry, workKey: string): boolean {
  const entry = registry.entries[workKey];
  return entry?.status === "ACTIVE";
}

/** Block duplicate spawns while an agent is running or recently finished (PR may be open). */
const IN_FLIGHT_MS = 48 * 60 * 60 * 1000;

export function hasInFlightWork(
  registry: Registry,
  role: string,
  subjectType: string,
  subjectId: string,
  now = Date.now()
): boolean {
  return Object.values(registry.entries).some((entry) => {
    if (
      entry.role !== role ||
      entry.subjectType !== subjectType ||
      entry.subjectId !== subjectId
    ) {
      return false;
    }
    if (entry.status === "ACTIVE") {
      return true;
    }
    if (entry.status === "FINISHED") {
      const updated = new Date(entry.updatedAt).getTime();
      return now - updated < IN_FLIGHT_MS;
    }
    return false;
  });
}

export function parseChangedPropertyIds(raw: string | undefined): Set<string> {
  if (!raw?.trim()) {
    return new Set();
  }
  return new Set(
    raw
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  );
}
