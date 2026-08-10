import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  loadPropertyContexts,
  loadBuilderTasks,
  loadActiveTaskIds,
  loadRegistry,
  saveRegistry,
  activeRegistryEntries,
  hasActiveWork,
  hasInFlightWork,
  parseChangedPropertyIds,
  shouldRunManagerTriage,
  repoPaths,
  type Registry,
} from "./repo.js";

const TEST_DIR = path.join(import.meta.dirname, "..", ".test-fixtures");

async function setup(): Promise<void> {
  await rm(TEST_DIR, { recursive: true, force: true });
  await mkdir(TEST_DIR, { recursive: true });
}

async function teardown(): Promise<void> {
  await rm(TEST_DIR, { recursive: true, force: true });
}

// =============================================================================
// repoPaths tests
// =============================================================================

test("repoPaths returns correct directory structure", () => {
  const paths = repoPaths("/workspace");

  assert.equal(paths.root, "/workspace");
  assert.equal(paths.propertiesDir, "/workspace/data/properties");
  assert.equal(paths.tasksBacklogDir, "/workspace/tasks/backlog");
  assert.equal(paths.tasksActiveDir, "/workspace/tasks/active");
  assert.equal(paths.registryPath, "/workspace/data/orchestrator/registry.json");
});

// =============================================================================
// loadPropertyContexts tests
// =============================================================================

test("loadPropertyContexts loads properties from directory", async () => {
  await setup();
  const propertiesDir = path.join(TEST_DIR, "properties");

  await mkdir(path.join(propertiesDir, "prop-1"), { recursive: true });
  await writeFile(
    path.join(propertiesDir, "prop-1", "meta.json"),
    JSON.stringify({
      id: "prop-1",
      workflow_state: "CANDIDATE",
      address: "123 Test St",
    })
  );

  await mkdir(path.join(propertiesDir, "prop-2"), { recursive: true });
  await writeFile(
    path.join(propertiesDir, "prop-2", "meta.json"),
    JSON.stringify({
      id: "prop-2",
      workflow_state: "SCREENED",
      scout_decision: "RESEARCH",
    })
  );
  await writeFile(
    path.join(propertiesDir, "prop-2", "evidence.json"),
    JSON.stringify({ purchase_price: { value: 200000 } })
  );

  const contexts = await loadPropertyContexts(propertiesDir);

  assert.equal(contexts.length, 2);

  const prop1 = contexts.find((c) => c.propertyId === "prop-1");
  assert.ok(prop1);
  assert.equal(prop1.meta.workflow_state, "CANDIDATE");
  assert.equal(prop1.hasEvidence, false);

  const prop2 = contexts.find((c) => c.propertyId === "prop-2");
  assert.ok(prop2);
  assert.equal(prop2.meta.workflow_state, "SCREENED");
  assert.equal(prop2.hasEvidence, true);

  await teardown();
});

test("loadPropertyContexts excludes _example directory", async () => {
  await setup();
  const propertiesDir = path.join(TEST_DIR, "properties");

  await mkdir(path.join(propertiesDir, "_example"), { recursive: true });
  await writeFile(
    path.join(propertiesDir, "_example", "meta.json"),
    JSON.stringify({ id: "_example", workflow_state: "AUDIT" })
  );

  await mkdir(path.join(propertiesDir, "real-prop"), { recursive: true });
  await writeFile(
    path.join(propertiesDir, "real-prop", "meta.json"),
    JSON.stringify({ id: "real-prop", workflow_state: "CANDIDATE" })
  );

  const contexts = await loadPropertyContexts(propertiesDir);

  assert.equal(contexts.length, 1);
  assert.equal(contexts[0]?.propertyId, "real-prop");

  await teardown();
});

test("loadPropertyContexts returns empty array for missing directory", async () => {
  const contexts = await loadPropertyContexts("/nonexistent/path");
  assert.deepEqual(contexts, []);
});

test("loadPropertyContexts detects underwriting and audit files", async () => {
  await setup();
  const propertiesDir = path.join(TEST_DIR, "properties");

  await mkdir(path.join(propertiesDir, "complete-prop"), { recursive: true });
  await writeFile(
    path.join(propertiesDir, "complete-prop", "meta.json"),
    JSON.stringify({ id: "complete-prop", workflow_state: "AUDIT" })
  );
  await writeFile(
    path.join(propertiesDir, "complete-prop", "evidence.json"),
    "{}"
  );
  await writeFile(
    path.join(propertiesDir, "complete-prop", "underwriting.json"),
    "{}"
  );
  await writeFile(
    path.join(propertiesDir, "complete-prop", "audit.json"),
    JSON.stringify({ result: "PASS", final_status: "VIABLE" })
  );

  const contexts = await loadPropertyContexts(propertiesDir);

  assert.equal(contexts.length, 1);
  assert.equal(contexts[0]?.hasEvidence, true);
  assert.equal(contexts[0]?.hasUnderwriting, true);
  assert.equal(contexts[0]?.hasAudit, true);
  assert.equal(contexts[0]?.audit?.result, "PASS");
  assert.equal(contexts[0]?.audit?.final_status, "VIABLE");

  await teardown();
});

// =============================================================================
// loadBuilderTasks tests
// =============================================================================

test("loadBuilderTasks loads tasks from backlog directory", async () => {
  await setup();
  const backlogDir = path.join(TEST_DIR, "backlog");
  const activeDir = path.join(TEST_DIR, "active");

  await mkdir(backlogDir, { recursive: true });
  await mkdir(activeDir, { recursive: true });

  await writeFile(
    path.join(backlogDir, "TASK-001-first-task.md"),
    "**Priority:** P1\n\nTask content"
  );
  await writeFile(
    path.join(backlogDir, "TASK-002-second-task.md"),
    "**Priority:** P2\n\nTask content"
  );

  const tasks = await loadBuilderTasks(backlogDir, activeDir, new Set());

  assert.equal(tasks.length, 2);
  assert.equal(tasks[0]?.taskId, "TASK-001");
  assert.equal(tasks[0]?.slug, "first-task");
  assert.equal(tasks[0]?.priority, 10);
  assert.equal(tasks[1]?.taskId, "TASK-002");
  assert.equal(tasks[1]?.priority, 20);

  await teardown();
});

test("loadBuilderTasks excludes tasks already in active", async () => {
  await setup();
  const backlogDir = path.join(TEST_DIR, "backlog");
  const activeDir = path.join(TEST_DIR, "active");

  await mkdir(backlogDir, { recursive: true });
  await mkdir(activeDir, { recursive: true });

  await writeFile(
    path.join(backlogDir, "TASK-001-first-task.md"),
    "**Priority:** P1"
  );

  const tasks = await loadBuilderTasks(backlogDir, activeDir, new Set(["TASK-001"]));

  assert.equal(tasks.length, 0);

  await teardown();
});

test("loadBuilderTasks handles P0 priority", async () => {
  await setup();
  const backlogDir = path.join(TEST_DIR, "backlog");
  const activeDir = path.join(TEST_DIR, "active");

  await mkdir(backlogDir, { recursive: true });
  await mkdir(activeDir, { recursive: true });

  await writeFile(
    path.join(backlogDir, "TASK-001-urgent.md"),
    "**Priority:** P0\n\nUrgent task"
  );

  const tasks = await loadBuilderTasks(backlogDir, activeDir, new Set());

  assert.equal(tasks[0]?.priority, 1);

  await teardown();
});

test("loadBuilderTasks returns empty array for missing directory", async () => {
  const tasks = await loadBuilderTasks("/nonexistent", "/also-nonexistent", new Set());
  assert.deepEqual(tasks, []);
});

// =============================================================================
// loadActiveTaskIds tests
// =============================================================================

test("loadActiveTaskIds loads task IDs from active directory", async () => {
  await setup();
  const activeDir = path.join(TEST_DIR, "active");

  await mkdir(activeDir, { recursive: true });
  await writeFile(path.join(activeDir, "TASK-001-schema.md"), "content");
  await writeFile(path.join(activeDir, "TASK-002-ui.md"), "content");
  await writeFile(path.join(activeDir, ".gitkeep"), "");

  const ids = await loadActiveTaskIds(activeDir);

  assert.equal(ids.size, 2);
  assert.ok(ids.has("TASK-001"));
  assert.ok(ids.has("TASK-002"));

  await teardown();
});

test("loadActiveTaskIds returns empty set for missing directory", async () => {
  const ids = await loadActiveTaskIds("/nonexistent");
  assert.equal(ids.size, 0);
});

// =============================================================================
// Registry tests
// =============================================================================

test("loadRegistry returns empty registry for missing file", async () => {
  const registry = await loadRegistry("/nonexistent/registry.json");

  assert.equal(registry.version, 1);
  assert.deepEqual(registry.entries, {});
});

test("loadRegistry loads existing registry", async () => {
  await setup();
  const registryPath = path.join(TEST_DIR, "registry.json");

  const existing: Registry = {
    version: 1,
    entries: {
      "builder:task:TASK-001:implement": {
        workKey: "builder:task:TASK-001:implement",
        role: "builder",
        subjectType: "task",
        subjectId: "TASK-001",
        action: "implement",
        branch: "agent/task-001",
        agentId: "bc-123",
        status: "ACTIVE",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    },
  };

  await writeFile(registryPath, JSON.stringify(existing));

  const registry = await loadRegistry(registryPath);

  assert.equal(registry.version, 1);
  assert.ok(registry.entries["builder:task:TASK-001:implement"]);
  assert.equal(
    registry.entries["builder:task:TASK-001:implement"]?.status,
    "ACTIVE"
  );

  await teardown();
});

test("saveRegistry creates parent directories", async () => {
  await setup();
  const registryPath = path.join(TEST_DIR, "nested", "dir", "registry.json");

  const registry: Registry = {
    version: 1,
    entries: {},
  };

  await saveRegistry(registryPath, registry);
  const loaded = await loadRegistry(registryPath);

  assert.deepEqual(loaded, registry);

  await teardown();
});

test("activeRegistryEntries filters to ACTIVE status", () => {
  const registry: Registry = {
    version: 1,
    entries: {
      active1: {
        workKey: "active1",
        role: "builder",
        subjectType: "task",
        subjectId: "T1",
        action: "build",
        branch: "b1",
        agentId: "a1",
        status: "ACTIVE",
        createdAt: "",
        updatedAt: "",
      },
      finished: {
        workKey: "finished",
        role: "builder",
        subjectType: "task",
        subjectId: "T2",
        action: "build",
        branch: "b2",
        agentId: "a2",
        status: "FINISHED",
        createdAt: "",
        updatedAt: "",
      },
      active2: {
        workKey: "active2",
        role: "scout",
        subjectType: "property",
        subjectId: "P1",
        action: "screen",
        branch: "b3",
        agentId: "a3",
        status: "ACTIVE",
        createdAt: "",
        updatedAt: "",
      },
    },
  };

  const active = activeRegistryEntries(registry);

  assert.equal(active.length, 2);
  assert.ok(active.some((e) => e.workKey === "active1"));
  assert.ok(active.some((e) => e.workKey === "active2"));
});

test("hasActiveWork returns true for ACTIVE entry", () => {
  const registry: Registry = {
    version: 1,
    entries: {
      "my-work": {
        workKey: "my-work",
        role: "builder",
        subjectType: "task",
        subjectId: "T1",
        action: "build",
        branch: "b1",
        agentId: "a1",
        status: "ACTIVE",
        createdAt: "",
        updatedAt: "",
      },
    },
  };

  assert.equal(hasActiveWork(registry, "my-work"), true);
  assert.equal(hasActiveWork(registry, "other-work"), false);
});

test("hasActiveWork returns false for FINISHED entry", () => {
  const registry: Registry = {
    version: 1,
    entries: {
      "my-work": {
        workKey: "my-work",
        role: "builder",
        subjectType: "task",
        subjectId: "T1",
        action: "build",
        branch: "b1",
        agentId: "a1",
        status: "FINISHED",
        createdAt: "",
        updatedAt: "",
      },
    },
  };

  assert.equal(hasActiveWork(registry, "my-work"), false);
});

// =============================================================================
// shouldRunManagerTriage tests
// =============================================================================

test("shouldRunManagerTriage returns true when CANDIDATE properties exist", () => {
  const result = shouldRunManagerTriage(
    [
      {
        propertyId: "prop-1",
        meta: { id: "prop-1", workflow_state: "CANDIDATE" },
        hasEvidence: false,
        hasUnderwriting: false,
        hasAudit: false,
      },
    ],
    []
  );

  assert.equal(result, true);
});

test("shouldRunManagerTriage returns true when RANKED properties exist", () => {
  const result = shouldRunManagerTriage(
    [
      {
        propertyId: "prop-1",
        meta: { id: "prop-1", workflow_state: "RANKED" },
        hasEvidence: true,
        hasUnderwriting: true,
        hasAudit: true,
      },
    ],
    []
  );

  assert.equal(result, true);
});

test("shouldRunManagerTriage returns true when builder tasks exist", () => {
  const result = shouldRunManagerTriage(
    [],
    [
      {
        taskId: "TASK-001",
        slug: "test",
        filePath: "tasks/backlog/TASK-001-test.md",
        priority: 10,
      },
    ]
  );

  assert.equal(result, true);
});

test("shouldRunManagerTriage returns false when no attention needed", () => {
  const result = shouldRunManagerTriage(
    [
      {
        propertyId: "prop-1",
        meta: { id: "prop-1", workflow_state: "PUBLISHED" },
        hasEvidence: true,
        hasUnderwriting: true,
        hasAudit: true,
      },
    ],
    []
  );

  assert.equal(result, false);
});

test("parseChangedPropertyIds splits comma list", () => {
  const ids = parseChangedPropertyIds("a,b, c");
  assert.deepEqual([...ids], ["a", "b", "c"]);
});

test("hasInFlightWork blocks recently finished subject", () => {
  const registry: Registry = {
    version: 1,
    entries: {
      "researcher:property:prop-a:build-evidence": {
        workKey: "researcher:property:prop-a:build-evidence",
        role: "researcher",
        subjectType: "property",
        subjectId: "prop-a",
        action: "build-evidence",
        branch: "agent/prop-a-research",
        agentId: "bc-test",
        status: "FINISHED",
        createdAt: "2026-08-10T00:00:00Z",
        updatedAt: new Date().toISOString(),
      },
    },
  };

  assert.equal(
    hasInFlightWork(registry, "researcher", "property", "prop-a"),
    true
  );
  assert.equal(
    hasInFlightWork(registry, "underwriter", "property", "prop-a"),
    false
  );
});
