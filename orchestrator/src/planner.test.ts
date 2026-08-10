import test from "node:test";
import assert from "node:assert/strict";
import { planWork, type PropertyContext, type BuilderTask } from "./planner.js";

function property(
  overrides: Partial<PropertyContext> & Pick<PropertyContext, "propertyId" | "meta">
): PropertyContext {
  return {
    hasEvidence: false,
    hasUnderwriting: false,
    hasAudit: false,
    ...overrides,
  };
}

function builderTask(overrides: Partial<BuilderTask> = {}): BuilderTask {
  return {
    taskId: "TASK-001",
    slug: "test-task",
    filePath: "tasks/backlog/TASK-001-test-task.md",
    priority: 10,
    ...overrides,
  };
}

// =============================================================================
// AC-1: Orchestrator plan correctly identifies pending work from backlog tasks
// =============================================================================

test("AC-1: builder tasks are included from backlog metadata", () => {
  const items = planWork({
    properties: [],
    builderTasks: [
      builderTask({
        taskId: "TASK-001",
        slug: "property-data-schema",
        filePath: "tasks/backlog/TASK-001-property-data-schema.md",
        priority: 1,
      }),
    ],
    pendingManagerReview: false,
  });

  assert.equal(items[0]?.role, "builder");
  assert.match(items[0]?.branch ?? "", /agent\/task-001-property-data-schema/);
});

test("AC-1: multiple builder tasks are planned with correct priorities", () => {
  const items = planWork({
    properties: [],
    builderTasks: [
      builderTask({ taskId: "TASK-002", slug: "ui-feature", priority: 20 }),
      builderTask({ taskId: "TASK-001", slug: "schema", priority: 10 }),
      builderTask({ taskId: "TASK-003", slug: "api", priority: 10 }),
    ],
    pendingManagerReview: false,
  });

  assert.equal(items.length, 3);
  assert.equal(items[0]?.subjectId, "TASK-001");
  assert.equal(items[1]?.subjectId, "TASK-003");
  assert.equal(items[2]?.subjectId, "TASK-002");
});

test("AC-1: builder task prompt includes task file path", () => {
  const items = planWork({
    properties: [],
    builderTasks: [
      builderTask({
        taskId: "TASK-005",
        slug: "pipeline-validation",
        filePath: "tasks/backlog/TASK-005-pipeline-validation.md",
      }),
    ],
    pendingManagerReview: false,
  });

  assert.match(items[0]?.prompt ?? "", /TASK-005/);
  assert.match(items[0]?.prompt ?? "", /tasks\/backlog\/TASK-005-pipeline-validation\.md/);
});

test("AC-1: builder work key is correctly formatted", () => {
  const items = planWork({
    properties: [],
    builderTasks: [builderTask({ taskId: "TASK-007" })],
    pendingManagerReview: false,
  });

  assert.equal(items[0]?.key, "builder:task:TASK-007:implement-task");
});

// =============================================================================
// AC-2: Orchestrator plan identifies property workflow state transitions
// =============================================================================

test("AC-2: CANDIDATE routes to scout", () => {
  const items = planWork({
    properties: [
      property({
        propertyId: "123-main-st",
        meta: { id: "123-main-st", workflow_state: "CANDIDATE" },
      }),
    ],
    builderTasks: [],
    pendingManagerReview: false,
  });

  assert.equal(items.length, 1);
  assert.equal(items[0]?.role, "scout");
  assert.equal(items[0]?.action, "screen-listing");
});

test("AC-2: SCREENED with RESEARCH decision routes to researcher", () => {
  const items = planWork({
    properties: [
      property({
        propertyId: "456-oak-ave",
        meta: {
          id: "456-oak-ave",
          workflow_state: "SCREENED",
          scout_decision: "RESEARCH",
        },
        hasEvidence: false,
      }),
    ],
    builderTasks: [],
    pendingManagerReview: false,
  });

  assert.equal(items.length, 1);
  assert.equal(items[0]?.role, "researcher");
  assert.equal(items[0]?.action, "build-evidence");
});

test("AC-2: SCREENED with REJECT does not spawn researcher", () => {
  const items = planWork({
    properties: [
      property({
        propertyId: "789-elm-st",
        meta: {
          id: "789-elm-st",
          workflow_state: "SCREENED",
          scout_decision: "REJECT",
        },
      }),
    ],
    builderTasks: [],
    pendingManagerReview: false,
  });

  assert.equal(items.length, 0);
});

test("AC-2: RESEARCHING routes to researcher", () => {
  const items = planWork({
    properties: [
      property({
        propertyId: "222-pine-dr",
        meta: { id: "222-pine-dr", workflow_state: "RESEARCHING" },
      }),
    ],
    builderTasks: [],
    pendingManagerReview: false,
  });

  assert.equal(items[0]?.role, "researcher");
  assert.equal(items[0]?.action, "complete-evidence");
});

test("AC-2: READY_FOR_UNDERWRITING routes to underwriter when evidence exists", () => {
  const items = planWork({
    properties: [
      property({
        propertyId: "123-main-st",
        meta: { id: "123-main-st", workflow_state: "READY_FOR_UNDERWRITING" },
        hasEvidence: true,
      }),
    ],
    builderTasks: [],
    pendingManagerReview: false,
  });

  assert.equal(items[0]?.role, "underwriter");
  assert.equal(items[0]?.action, "underwrite");
});

test("AC-2: READY_FOR_UNDERWRITING routes to researcher when evidence missing", () => {
  const items = planWork({
    properties: [
      property({
        propertyId: "123-main-st",
        meta: { id: "123-main-st", workflow_state: "READY_FOR_UNDERWRITING" },
        hasEvidence: false,
      }),
    ],
    builderTasks: [],
    pendingManagerReview: false,
  });

  assert.equal(items[0]?.role, "researcher");
  assert.equal(items[0]?.action, "build-evidence");
});

test("AC-2: UNDERWRITTEN routes to auditor when underwriting exists", () => {
  const items = planWork({
    properties: [
      property({
        propertyId: "333-beach-rd",
        meta: { id: "333-beach-rd", workflow_state: "UNDERWRITTEN" },
        hasEvidence: true,
        hasUnderwriting: true,
      }),
    ],
    builderTasks: [],
    pendingManagerReview: false,
  });

  assert.equal(items[0]?.role, "auditor");
  assert.equal(items[0]?.action, "audit");
});

test("AC-2: UNDERWRITTEN routes to underwriter when underwriting missing", () => {
  const items = planWork({
    properties: [
      property({
        propertyId: "333-beach-rd",
        meta: { id: "333-beach-rd", workflow_state: "UNDERWRITTEN" },
        hasEvidence: true,
        hasUnderwriting: false,
      }),
    ],
    builderTasks: [],
    pendingManagerReview: false,
  });

  assert.equal(items[0]?.role, "underwriter");
});

test("AC-2: AUDIT with NEEDS_RESEARCH routes back to researcher", () => {
  const items = planWork({
    properties: [
      property({
        propertyId: "123-main-st",
        meta: { id: "123-main-st", workflow_state: "AUDIT" },
        hasEvidence: true,
        hasUnderwriting: true,
        hasAudit: true,
        audit: { result: "NEEDS_RESEARCH" },
      }),
    ],
    builderTasks: [],
    pendingManagerReview: false,
  });

  assert.equal(items[0]?.role, "researcher");
  assert.equal(items[0]?.action, "fill-audit-gaps");
});

test("AC-2: AUDIT with PASS routes to manager", () => {
  const items = planWork({
    properties: [
      property({
        propertyId: "444-shore-dr",
        meta: { id: "444-shore-dr", workflow_state: "AUDIT" },
        hasEvidence: true,
        hasUnderwriting: true,
        hasAudit: true,
        audit: { result: "PASS", final_status: "VIABLE" },
      }),
    ],
    builderTasks: [],
    pendingManagerReview: false,
  });

  assert.equal(items[0]?.role, "manager");
  assert.equal(items[0]?.action, "rank-or-close");
});

test("AC-2: AUDIT with DOWNGRADE routes to manager", () => {
  const items = planWork({
    properties: [
      property({
        propertyId: "555-lake-ln",
        meta: { id: "555-lake-ln", workflow_state: "AUDIT" },
        hasEvidence: true,
        hasUnderwriting: true,
        hasAudit: true,
        audit: { result: "DOWNGRADE", final_status: "WATCHLIST" },
      }),
    ],
    builderTasks: [],
    pendingManagerReview: false,
  });

  assert.equal(items[0]?.role, "manager");
  assert.equal(items[0]?.action, "rank-or-close");
});

test("AC-2: RANKED routes to manager for publish", () => {
  const items = planWork({
    properties: [
      property({
        propertyId: "666-river-rd",
        meta: { id: "666-river-rd", workflow_state: "RANKED" },
      }),
    ],
    builderTasks: [],
    pendingManagerReview: false,
  });

  assert.equal(items[0]?.role, "manager");
  assert.equal(items[0]?.action, "publish");
});

test("AC-2: PUBLISHED does not spawn any agent", () => {
  const items = planWork({
    properties: [
      property({
        propertyId: "777-hill-ct",
        meta: { id: "777-hill-ct", workflow_state: "PUBLISHED" },
      }),
    ],
    builderTasks: [],
    pendingManagerReview: false,
  });

  assert.equal(items.length, 0);
});

test("AC-2: ARCHIVED with due rescreen routes to scout", () => {
  const items = planWork({
    properties: [
      property({
        propertyId: "550-shore-dr-unit-304",
        meta: {
          id: "550-shore-dr-unit-304",
          workflow_state: "ARCHIVED",
          listing_url: "https://example.com/listing",
          rescreen_after: "2020-01-01T00:00:00Z",
          archive_reason: "scout_reject",
        },
      }),
    ],
    builderTasks: [],
    pendingManagerReview: false,
  });

  assert.equal(items.length, 1);
  assert.equal(items[0]?.role, "scout");
  assert.equal(items[0]?.action, "rescreen-listing");
});

test("AC-2: ARCHIVED before rescreen_after does not spawn scout", () => {
  const items = planWork({
    properties: [
      property({
        propertyId: "550-shore-dr-unit-304",
        meta: {
          id: "550-shore-dr-unit-304",
          workflow_state: "ARCHIVED",
          rescreen_after: "2099-01-01T00:00:00Z",
        },
      }),
    ],
    builderTasks: [],
    pendingManagerReview: false,
  });

  assert.equal(items.length, 0);
});

// =============================================================================
// AC-3: Dry run output shows expected agent spawns (work items are correctly
// structured for display)
// =============================================================================

test("AC-3: work items include all required fields for display", () => {
  const items = planWork({
    properties: [
      property({
        propertyId: "test-property",
        meta: { id: "test-property", workflow_state: "CANDIDATE" },
      }),
    ],
    builderTasks: [builderTask({ taskId: "TASK-010" })],
    pendingManagerReview: false,
  });

  for (const item of items) {
    assert.ok(item.key, "work item should have key");
    assert.ok(item.role, "work item should have role");
    assert.ok(item.subjectType, "work item should have subjectType");
    assert.ok(item.subjectId, "work item should have subjectId");
    assert.ok(item.action, "work item should have action");
    assert.ok(item.branch, "work item should have branch");
    assert.ok(typeof item.priority === "number", "work item should have priority");
    assert.ok(item.prompt, "work item should have prompt");
  }
});

test("AC-3: work items are sorted by priority", () => {
  const items = planWork({
    properties: [
      property({
        propertyId: "prop-1",
        meta: { id: "prop-1", workflow_state: "UNDERWRITTEN" },
        hasUnderwriting: true,
      }),
      property({
        propertyId: "prop-2",
        meta: { id: "prop-2", workflow_state: "CANDIDATE" },
      }),
    ],
    builderTasks: [],
    pendingManagerReview: false,
  });

  for (let i = 1; i < items.length; i++) {
    assert.ok(
      items[i - 1]!.priority <= items[i]!.priority,
      "items should be sorted by priority ascending"
    );
  }
});

// =============================================================================
// AC-5: Agent branches follow naming convention
// =============================================================================

test("AC-5: property branches follow agent/{property-id}-{role} pattern", () => {
  const states: Array<{ state: string; expectedRole: string }> = [
    { state: "CANDIDATE", expectedRole: "scout" },
    { state: "RESEARCHING", expectedRole: "research" },
    { state: "READY_FOR_UNDERWRITING", expectedRole: "underwrite" },
  ];

  for (const { state, expectedRole } of states) {
    const items = planWork({
      properties: [
        property({
          propertyId: "test-prop-123",
          meta: { id: "test-prop-123", workflow_state: state as any },
          hasEvidence: state === "READY_FOR_UNDERWRITING",
        }),
      ],
      builderTasks: [],
      pendingManagerReview: false,
    });

    if (items.length > 0) {
      const branch = items[0]?.branch ?? "";
      assert.match(
        branch,
        /^agent\/test-prop-123-/,
        `branch for ${state} should start with agent/test-prop-123-`
      );
    }
  }
});

test("AC-5: builder task branches follow agent/task-NNN-slug pattern", () => {
  const items = planWork({
    properties: [],
    builderTasks: [
      builderTask({
        taskId: "TASK-005",
        slug: "pipeline-validation",
      }),
    ],
    pendingManagerReview: false,
  });

  const branch = items[0]?.branch ?? "";
  assert.match(
    branch,
    /^agent\/task-005-pipeline-validation$/,
    "builder branch should match agent/task-NNN-slug pattern"
  );
});

test("AC-5: manager triage branch follows agent/{role}-{action} pattern", () => {
  const items = planWork({
    properties: [],
    builderTasks: [],
    pendingManagerReview: true,
  });

  const managerItem = items.find((i) => i.role === "manager");
  assert.ok(managerItem, "should have manager work item");
  assert.equal(
    managerItem.branch,
    "agent/manager-triage",
    "manager triage branch should be agent/manager-triage"
  );
});

test("AC-5: rescreen branches include rescreen suffix", () => {
  const items = planWork({
    properties: [
      property({
        propertyId: "archived-prop",
        meta: {
          id: "archived-prop",
          workflow_state: "ARCHIVED",
          rescreen_after: "2020-01-01T00:00:00Z",
        },
      }),
    ],
    builderTasks: [],
    pendingManagerReview: false,
  });

  const branch = items[0]?.branch ?? "";
  assert.match(
    branch,
    /^agent\/archived-prop-rescreen$/,
    "rescreen branch should end with -rescreen"
  );
});

// =============================================================================
// Additional edge cases
// =============================================================================

test("mixed properties and tasks are all included", () => {
  const items = planWork({
    properties: [
      property({
        propertyId: "prop-a",
        meta: { id: "prop-a", workflow_state: "CANDIDATE" },
      }),
      property({
        propertyId: "prop-b",
        meta: {
          id: "prop-b",
          workflow_state: "SCREENED",
          scout_decision: "RESEARCH",
        },
      }),
    ],
    builderTasks: [builderTask({ taskId: "TASK-001" })],
    pendingManagerReview: true,
  });

  const roles = items.map((i) => i.role);
  assert.ok(roles.includes("scout"), "should include scout");
  assert.ok(roles.includes("researcher"), "should include researcher");
  assert.ok(roles.includes("builder"), "should include builder");
  assert.ok(roles.includes("manager"), "should include manager");
});

test("manager review triggered when CANDIDATE properties exist", () => {
  const items = planWork({
    properties: [
      property({
        propertyId: "new-prop",
        meta: { id: "new-prop", workflow_state: "CANDIDATE" },
      }),
    ],
    builderTasks: [],
    pendingManagerReview: true,
  });

  const hasManager = items.some((i) => i.role === "manager");
  assert.ok(hasManager, "should have manager when pendingManagerReview is true");
});

test("manager review triggered when RANKED properties exist", () => {
  const items = planWork({
    properties: [
      property({
        propertyId: "ranked-prop",
        meta: { id: "ranked-prop", workflow_state: "RANKED" },
      }),
    ],
    builderTasks: [],
    pendingManagerReview: true,
  });

  const managerItems = items.filter((i) => i.role === "manager");
  assert.ok(managerItems.length >= 1, "should have manager work items");
});

test("empty input produces no work items", () => {
  const items = planWork({
    properties: [],
    builderTasks: [],
    pendingManagerReview: false,
  });

  assert.equal(items.length, 0);
});

test("prompts include role header", () => {
  const items = planWork({
    properties: [
      property({
        propertyId: "test-prop",
        meta: { id: "test-prop", workflow_state: "CANDIDATE" },
      }),
    ],
    builderTasks: [builderTask()],
    pendingManagerReview: false,
  });

  for (const item of items) {
    const expectedHeader = `You are the ${item.role.charAt(0).toUpperCase()}${item.role.slice(1)} agent`;
    assert.match(item.prompt, new RegExp(expectedHeader), `prompt should include role header for ${item.role}`);
  }
});
