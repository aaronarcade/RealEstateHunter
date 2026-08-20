import { readdir, readFile, access, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type {
  BuilderTask,
  PropertyAudit,
  PropertyContext,
  PropertyMeta,
} from "./planner.js";

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
