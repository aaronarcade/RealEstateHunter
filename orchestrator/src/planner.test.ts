import test from "node:test";
import assert from "node:assert/strict";
import { planWork, type PropertyContext } from "./planner.js";

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

test("CANDIDATE routes to scout", () => {
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
});

test("READY_FOR_UNDERWRITING routes to underwriter when evidence exists", () => {
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
});

test("AUDIT with NEEDS_RESEARCH routes back to researcher", () => {
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

test("builder tasks are included from backlog metadata", () => {
  const items = planWork({
    properties: [],
    builderTasks: [
      {
        taskId: "TASK-001",
        slug: "property-data-schema",
        filePath: "tasks/backlog/TASK-001-property-data-schema.md",
        priority: 1,
      },
    ],
    pendingManagerReview: false,
  });

  assert.equal(items[0]?.role, "builder");
  assert.match(items[0]?.branch ?? "", /agent\/task-001-property-data-schema/);
});
