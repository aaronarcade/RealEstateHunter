import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, rm, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { planOnly } from "./orchestrator.js";
import {
  loadConfig,
  isRoleEnabled,
  roleHasCapacity,
  countActiveForRole,
  type OrchestratorConfig,
} from "./cursor-client.js";

const TEST_DIR = path.join(import.meta.dirname, "..", ".test-fixtures-orch");

async function setup(): Promise<string> {
  await rm(TEST_DIR, { recursive: true, force: true });
  await mkdir(TEST_DIR, { recursive: true });

  await mkdir(path.join(TEST_DIR, "data", "properties"), { recursive: true });
  await mkdir(path.join(TEST_DIR, "data", "orchestrator"), { recursive: true });
  await mkdir(path.join(TEST_DIR, "tasks", "backlog"), { recursive: true });
  await mkdir(path.join(TEST_DIR, "tasks", "active"), { recursive: true });

  const config = {
    repoUrl: "https://github.com/test/repo",
    startingRef: "main",
    maxConcurrentAgents: 5,
    autoCreatePR: true,
    skipReviewerRequest: true,
    roles: {
      builder: { enabled: true, maxConcurrent: 2 },
      scout: { enabled: true, maxConcurrent: 1 },
      researcher: { enabled: true, maxConcurrent: 2 },
    },
  };

  await writeFile(
    path.join(TEST_DIR, "orchestrator.config.json"),
    JSON.stringify(config, null, 2)
  );

  return TEST_DIR;
}

async function teardown(): Promise<void> {
  await rm(TEST_DIR, { recursive: true, force: true });
}

// =============================================================================
// AC-1: plan command correctly identifies pending work from backlog tasks
// =============================================================================

test("AC-1 integration: plan identifies builder task from backlog", async () => {
  const repoRoot = await setup();

  await writeFile(
    path.join(repoRoot, "tasks", "backlog", "TASK-010-test-feature.md"),
    `# TASK-010: Test feature

**Status:** BACKLOG
**Assignee:** Builder
**Priority:** P1

## Description

Test task for validation.

## Acceptance criteria

- [ ] Something works
`
  );

  const planned = await planOnly(repoRoot);

  const builderWork = planned.filter((w) => w.role === "builder");
  assert.ok(builderWork.length > 0, "should have builder work items");

  const taskWork = builderWork.find((w) => w.subjectId === "TASK-010");
  assert.ok(taskWork, "should find TASK-010 work item");
  assert.equal(taskWork.action, "implement-task");
  assert.match(taskWork.branch, /agent\/task-010-test-feature/);

  await teardown();
});

test("AC-1 integration: plan excludes tasks already in active", async () => {
  const repoRoot = await setup();

  await writeFile(
    path.join(repoRoot, "tasks", "backlog", "TASK-010-test.md"),
    "**Priority:** P1"
  );

  await writeFile(
    path.join(repoRoot, "tasks", "active", "TASK-010-test.md"),
    "**Priority:** P1 (in progress)"
  );

  const planned = await planOnly(repoRoot);

  const task010Work = planned.filter((w) => w.subjectId === "TASK-010");
  assert.equal(task010Work.length, 0, "should not plan task already in active");

  await teardown();
});

// =============================================================================
// AC-2: plan command correctly identifies property workflow state transitions
// =============================================================================

test("AC-2 integration: plan identifies SCREENED+RESEARCH property for researcher", async () => {
  const repoRoot = await setup();

  await mkdir(path.join(repoRoot, "data", "properties", "test-property"), {
    recursive: true,
  });
  await writeFile(
    path.join(repoRoot, "data", "properties", "test-property", "meta.json"),
    JSON.stringify({
      id: "test-property",
      address: "123 Test St",
      workflow_state: "SCREENED",
      scout_decision: "RESEARCH",
    })
  );

  const planned = await planOnly(repoRoot);

  const researcherWork = planned.find(
    (w) => w.role === "researcher" && w.subjectId === "test-property"
  );
  assert.ok(researcherWork, "should plan researcher for SCREENED+RESEARCH");
  assert.equal(researcherWork.action, "build-evidence");

  await teardown();
});

test("AC-2 integration: plan identifies CANDIDATE property for scout", async () => {
  const repoRoot = await setup();

  await mkdir(path.join(repoRoot, "data", "properties", "new-listing"), {
    recursive: true,
  });
  await writeFile(
    path.join(repoRoot, "data", "properties", "new-listing", "meta.json"),
    JSON.stringify({
      id: "new-listing",
      workflow_state: "CANDIDATE",
      listing_url: "https://example.com/listing",
    })
  );

  const planned = await planOnly(repoRoot);

  const scoutWork = planned.find(
    (w) => w.role === "scout" && w.subjectId === "new-listing"
  );
  assert.ok(scoutWork, "should plan scout for CANDIDATE");
  assert.equal(scoutWork.action, "screen-listing");

  await teardown();
});

test("AC-2 integration: plan identifies UNDERWRITTEN property for auditor", async () => {
  const repoRoot = await setup();

  await mkdir(path.join(repoRoot, "data", "properties", "ready-for-audit"), {
    recursive: true,
  });
  await writeFile(
    path.join(repoRoot, "data", "properties", "ready-for-audit", "meta.json"),
    JSON.stringify({
      id: "ready-for-audit",
      workflow_state: "UNDERWRITTEN",
    })
  );
  await writeFile(
    path.join(
      repoRoot,
      "data",
      "properties",
      "ready-for-audit",
      "evidence.json"
    ),
    "{}"
  );
  await writeFile(
    path.join(
      repoRoot,
      "data",
      "properties",
      "ready-for-audit",
      "underwriting.json"
    ),
    "{}"
  );

  const planned = await planOnly(repoRoot);

  const auditorWork = planned.find(
    (w) => w.role === "auditor" && w.subjectId === "ready-for-audit"
  );
  assert.ok(auditorWork, "should plan auditor for UNDERWRITTEN with files");
  assert.equal(auditorWork.action, "audit");

  await teardown();
});

test("AC-2 integration: plan excludes _example property", async () => {
  const repoRoot = await setup();

  await mkdir(path.join(repoRoot, "data", "properties", "_example"), {
    recursive: true,
  });
  await writeFile(
    path.join(repoRoot, "data", "properties", "_example", "meta.json"),
    JSON.stringify({
      id: "_example",
      workflow_state: "CANDIDATE",
    })
  );

  const planned = await planOnly(repoRoot);

  const exampleWork = planned.find((w) => w.subjectId === "_example");
  assert.equal(exampleWork, undefined, "should not plan _example property");

  await teardown();
});

// =============================================================================
// AC-3: run --dry-run shows expected agent spawns (via work item structure)
// =============================================================================

test("AC-3 integration: planned work items have all fields for display", async () => {
  const repoRoot = await setup();

  await mkdir(path.join(repoRoot, "data", "properties", "display-test"), {
    recursive: true,
  });
  await writeFile(
    path.join(repoRoot, "data", "properties", "display-test", "meta.json"),
    JSON.stringify({
      id: "display-test",
      address: "456 Display Ave",
      workflow_state: "CANDIDATE",
    })
  );

  await writeFile(
    path.join(repoRoot, "tasks", "backlog", "TASK-020-display.md"),
    "**Priority:** P2"
  );

  const planned = await planOnly(repoRoot);

  for (const item of planned) {
    assert.ok(item.key, `item ${item.subjectId} should have key`);
    assert.ok(item.role, `item ${item.subjectId} should have role`);
    assert.ok(item.subjectType, `item ${item.subjectId} should have subjectType`);
    assert.ok(item.subjectId, `item ${item.subjectId} should have subjectId`);
    assert.ok(item.action, `item ${item.subjectId} should have action`);
    assert.ok(item.branch, `item ${item.subjectId} should have branch`);
    assert.ok(
      typeof item.priority === "number",
      `item ${item.subjectId} should have numeric priority`
    );
    assert.ok(item.prompt, `item ${item.subjectId} should have prompt`);
  }

  await teardown();
});

// =============================================================================
// AC-4: Registry tracks spawned agents correctly
// =============================================================================

test("AC-4: registry entry format is correct", async () => {
  const repoRoot = await setup();

  const registryPath = path.join(
    repoRoot,
    "data",
    "orchestrator",
    "registry.json"
  );
  await writeFile(
    registryPath,
    JSON.stringify({
      version: 1,
      entries: {
        "builder:task:TASK-001:implement-task": {
          workKey: "builder:task:TASK-001:implement-task",
          role: "builder",
          subjectType: "task",
          subjectId: "TASK-001",
          action: "implement-task",
          branch: "agent/task-001-schema",
          agentId: "bc-test-123",
          status: "ACTIVE",
          createdAt: "2026-08-10T00:00:00Z",
          updatedAt: "2026-08-10T00:00:00Z",
        },
      },
    })
  );

  const raw = await readFile(registryPath, "utf8");
  const registry = JSON.parse(raw);

  assert.equal(registry.version, 1);

  const entry = registry.entries["builder:task:TASK-001:implement-task"];
  assert.ok(entry, "entry should exist");
  assert.equal(entry.role, "builder");
  assert.equal(entry.subjectType, "task");
  assert.equal(entry.subjectId, "TASK-001");
  assert.equal(entry.action, "implement-task");
  assert.match(entry.branch, /^agent\//);
  assert.ok(entry.agentId, "should have agentId");
  assert.ok(entry.status, "should have status");
  assert.ok(entry.createdAt, "should have createdAt");

  await teardown();
});

// =============================================================================
// AC-5: Agent branches follow naming convention
// =============================================================================

test("AC-5 integration: all planned branches follow naming convention", async () => {
  const repoRoot = await setup();

  await mkdir(path.join(repoRoot, "data", "properties", "branch-test-1"), {
    recursive: true,
  });
  await writeFile(
    path.join(repoRoot, "data", "properties", "branch-test-1", "meta.json"),
    JSON.stringify({
      id: "branch-test-1",
      workflow_state: "CANDIDATE",
    })
  );

  await mkdir(path.join(repoRoot, "data", "properties", "branch-test-2"), {
    recursive: true,
  });
  await writeFile(
    path.join(repoRoot, "data", "properties", "branch-test-2", "meta.json"),
    JSON.stringify({
      id: "branch-test-2",
      workflow_state: "SCREENED",
      scout_decision: "RESEARCH",
    })
  );

  await writeFile(
    path.join(repoRoot, "tasks", "backlog", "TASK-030-branch-test.md"),
    "**Priority:** P1"
  );

  const planned = await planOnly(repoRoot);

  const branchPattern = /^agent\/[a-z0-9-]+$/;

  for (const item of planned) {
    assert.match(
      item.branch,
      branchPattern,
      `branch "${item.branch}" should match agent/* pattern`
    );
  }

  const taskBranches = planned
    .filter((w) => w.subjectType === "task")
    .map((w) => w.branch);

  for (const branch of taskBranches) {
    assert.match(
      branch,
      /^agent\/task-\d+-[a-z0-9-]+$/,
      `task branch "${branch}" should match agent/task-NNN-* pattern`
    );
  }

  await teardown();
});

// =============================================================================
// Config loading tests
// =============================================================================

test("loadConfig parses valid config", () => {
  const raw = JSON.stringify({
    repoUrl: "https://github.com/test/repo",
    startingRef: "main",
    maxConcurrentAgents: 5,
    roles: {
      builder: { enabled: true, maxConcurrent: 2 },
    },
  });

  const config = loadConfig("test.json", raw);

  assert.equal(config.repoUrl, "https://github.com/test/repo");
  assert.equal(config.startingRef, "main");
  assert.equal(config.maxConcurrentAgents, 5);
  assert.equal(config.roles.builder?.enabled, true);
});

test("loadConfig throws on missing repoUrl", () => {
  const raw = JSON.stringify({ startingRef: "main" });

  assert.throws(() => loadConfig("test.json", raw), /Missing repoUrl/);
});

test("loadConfig uses defaults for optional fields", () => {
  const raw = JSON.stringify({ repoUrl: "https://github.com/test/repo" });

  const config = loadConfig("test.json", raw);

  assert.equal(config.startingRef, "main");
  assert.equal(config.maxConcurrentAgents, 3);
  assert.equal(config.autoCreatePR, true);
});

test("isRoleEnabled returns true when role not in config", () => {
  const config: OrchestratorConfig = {
    repoUrl: "",
    startingRef: "main",
    cloudEnvName: null,
    maxConcurrentAgents: 3,
    autoCreatePR: true,
    skipReviewerRequest: true,
    roles: {},
  };

  assert.equal(isRoleEnabled(config, "builder"), true);
});

test("isRoleEnabled returns false when explicitly disabled", () => {
  const config: OrchestratorConfig = {
    repoUrl: "",
    startingRef: "main",
    cloudEnvName: null,
    maxConcurrentAgents: 3,
    autoCreatePR: true,
    skipReviewerRequest: true,
    roles: {
      builder: { enabled: false, maxConcurrent: 1 },
    },
  };

  assert.equal(isRoleEnabled(config, "builder"), false);
});

test("countActiveForRole counts only matching ACTIVE entries", () => {
  const entries = [
    { role: "builder", status: "ACTIVE" },
    { role: "builder", status: "FINISHED" },
    { role: "scout", status: "ACTIVE" },
    { role: "builder", status: "ACTIVE" },
  ];

  assert.equal(countActiveForRole(entries, "builder"), 2);
  assert.equal(countActiveForRole(entries, "scout"), 1);
  assert.equal(countActiveForRole(entries, "researcher"), 0);
});

test("roleHasCapacity respects per-role limits", () => {
  const config: OrchestratorConfig = {
    repoUrl: "",
    startingRef: "main",
    cloudEnvName: null,
    maxConcurrentAgents: 10,
    autoCreatePR: true,
    skipReviewerRequest: true,
    roles: {
      builder: { enabled: true, maxConcurrent: 2 },
    },
  };

  assert.equal(roleHasCapacity(config, "builder", 0), true);
  assert.equal(roleHasCapacity(config, "builder", 1), true);
  assert.equal(roleHasCapacity(config, "builder", 2), false);
  assert.equal(roleHasCapacity(config, "builder", 3), false);
});

test("roleHasCapacity uses global limit when role not configured", () => {
  const config: OrchestratorConfig = {
    repoUrl: "",
    startingRef: "main",
    cloudEnvName: null,
    maxConcurrentAgents: 3,
    autoCreatePR: true,
    skipReviewerRequest: true,
    roles: {},
  };

  assert.equal(roleHasCapacity(config, "scout", 2), true);
  assert.equal(roleHasCapacity(config, "scout", 3), false);
});

// =============================================================================
// Mixed scenario tests
// =============================================================================

test("integration: mixed properties and tasks produce correct plan", async () => {
  const repoRoot = await setup();

  await mkdir(path.join(repoRoot, "data", "properties", "prop-candidate"), {
    recursive: true,
  });
  await writeFile(
    path.join(repoRoot, "data", "properties", "prop-candidate", "meta.json"),
    JSON.stringify({
      id: "prop-candidate",
      workflow_state: "CANDIDATE",
    })
  );

  await mkdir(path.join(repoRoot, "data", "properties", "prop-screened"), {
    recursive: true,
  });
  await writeFile(
    path.join(repoRoot, "data", "properties", "prop-screened", "meta.json"),
    JSON.stringify({
      id: "prop-screened",
      workflow_state: "SCREENED",
      scout_decision: "RESEARCH",
    })
  );

  await writeFile(
    path.join(repoRoot, "tasks", "backlog", "TASK-100-mixed.md"),
    "**Priority:** P1"
  );

  const planned = await planOnly(repoRoot);

  const roles = new Set(planned.map((w) => w.role));

  assert.ok(roles.has("scout"), "should have scout work");
  assert.ok(roles.has("researcher"), "should have researcher work");
  assert.ok(roles.has("builder"), "should have builder work");
  assert.ok(roles.has("manager"), "should have manager work (triage)");

  await teardown();
});
