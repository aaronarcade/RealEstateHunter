import test from "node:test";
import assert from "node:assert/strict";
import {
  hasInFlightWork,
  parseChangedPropertyIds,
  type Registry,
} from "./repo.js";

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
