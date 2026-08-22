export type WorkflowState =
  | "CANDIDATE"
  | "SCREENED"
  | "RESEARCHING"
  | "READY_FOR_UNDERWRITING"
  | "UNDERWRITTEN"
  | "AUDIT"
  | "RANKED"
  | "PUBLISHED"
  | "ARCHIVED";

export type AgentRole =
  | "manager"
  | "scout"
  | "analyst"
  | "auditor"
  | "builder";

export type WorkSubjectType = "property" | "task" | "system";

export interface WorkItem {
  key: string;
  role: AgentRole;
  subjectType: WorkSubjectType;
  subjectId: string;
  action: string;
  branch: string;
  priority: number;
  prompt: string;
}

export interface PropertyMeta {
  id: string;
  address?: string;
  listing_url?: string;
  market_id?: string;
  workflow_state: WorkflowState;
  scout_decision?: "REJECT" | "RESEARCH";
  rescreen_after?: string;
  rescreen_count?: number;
  archive_reason?: string;
  screening_snapshot?: {
    price?: number;
    rough_monthly_rent?: number;
    rough_gross_yield?: number;
    advertised_hoa?: number | null;
    screened_at?: string;
  };
}

export interface PropertyAudit {
  result?: "PASS" | "NEEDS_RESEARCH" | "DOWNGRADE";
  final_status?: "VIABLE" | "WATCHLIST" | "REJECTED";
}

export interface PropertyContext {
  propertyId: string;
  meta: PropertyMeta;
  hasEvidence: boolean;
  hasUnderwriting: boolean;
  hasAudit: boolean;
  audit?: PropertyAudit;
}

export interface BuilderTask {
  taskId: string;
  slug: string;
  filePath: string;
  priority: number;
}

export interface ScoutTask {
  taskId: string;
  slug: string;
  filePath: string;
  priority: number;
}

export interface PlannerInput {
  properties: PropertyContext[];
  builderTasks: BuilderTask[];
  scoutTasks?: ScoutTask[];
  deferInternational?: boolean;
  usActiveMarketIds?: Set<string>;
  pendingManagerReview: boolean;
}

export function planWork(input: PlannerInput): WorkItem[] {
  const items: WorkItem[] = [];
  const deferInternational = input.deferInternational ?? false;
  const usActiveMarketIds = input.usActiveMarketIds ?? new Set<string>();

  for (const property of input.properties) {
    const next = planPropertyWork(property, deferInternational, usActiveMarketIds);
    if (next) {
      items.push(next);
    }
  }

  for (const task of input.scoutTasks ?? []) {
    items.push(planScoutWork(task));
  }

  for (const task of input.builderTasks) {
    items.push(planBuilderWork(task));
  }

  if (input.pendingManagerReview) {
    items.push(planManagerReview());
  }

  return items.sort((a, b) => a.priority - b.priority);
}

function isDeferredInternationalProperty(
  meta: PropertyMeta,
  deferInternational: boolean,
  usActiveMarketIds: Set<string>
): boolean {
  if (!deferInternational || !meta.market_id) {
    return false;
  }
  return !usActiveMarketIds.has(meta.market_id);
}

function planPropertyWork(
  ctx: PropertyContext,
  deferInternational = false,
  usActiveMarketIds = new Set<string>()
): WorkItem | null {
  const { propertyId, meta } = ctx;
  const branchBase = `agent/${propertyId}`;

  if (
    isDeferredInternationalProperty(meta, deferInternational, usActiveMarketIds)
  ) {
    return null;
  }

  switch (meta.workflow_state) {
    case "CANDIDATE":
      return workItem({
        role: "scout",
        subjectType: "property",
        subjectId: propertyId,
        action: "screen-listing",
        branch: `${branchBase}-scout`,
        priority: 10,
        prompt: scoutPrompt(propertyId, meta),
      });

    case "SCREENED":
      if (meta.scout_decision === "REJECT") {
        if (isRescreenDue(meta)) {
          return rescreenWorkItem(propertyId, meta, branchBase);
        }
        return null;
      }
      if (!ctx.hasEvidence || !ctx.hasUnderwriting) {
        return analystWorkItem({
          propertyId,
          meta,
          branchBase,
          action: "analyze",
          priority: 20,
          mode: ctx.hasEvidence ? "underwrite-only" : "full",
        });
      }
      return null;

    case "RESEARCHING":
      if (ctx.hasEvidence && ctx.hasUnderwriting) {
        return null;
      }
      return analystWorkItem({
        propertyId,
        meta,
        branchBase,
        action: ctx.hasEvidence ? "complete-underwriting" : "analyze",
        priority: 20,
        mode: ctx.hasEvidence ? "underwrite-only" : "full",
      });

    case "READY_FOR_UNDERWRITING":
      if (ctx.hasEvidence && ctx.hasUnderwriting) {
        return null;
      }
      return analystWorkItem({
        propertyId,
        meta,
        branchBase,
        action: ctx.hasEvidence ? "complete-underwriting" : "analyze",
        priority: 20,
        mode: ctx.hasEvidence ? "underwrite-only" : "full",
      });

    case "UNDERWRITTEN":
      if (!ctx.hasUnderwriting) {
        return analystWorkItem({
          propertyId,
          meta,
          branchBase,
          action: "complete-underwriting",
          priority: 25,
          mode: ctx.hasEvidence ? "underwrite-only" : "full",
        });
      }
      return workItem({
        role: "auditor",
        subjectType: "property",
        subjectId: propertyId,
        action: "audit",
        branch: `${branchBase}-audit`,
        priority: 40,
        prompt: auditorPrompt(propertyId, meta),
      });

    case "AUDIT":
      if (!ctx.hasAudit) {
        return workItem({
          role: "auditor",
          subjectType: "property",
          subjectId: propertyId,
          action: "audit",
          branch: `${branchBase}-audit`,
          priority: 40,
          prompt: auditorPrompt(propertyId, meta),
        });
      }
      if (ctx.audit?.result === "NEEDS_RESEARCH") {
        return analystWorkItem({
          propertyId,
          meta,
          branchBase,
          action: "fill-audit-gaps",
          priority: 15,
          mode: "audit-gaps",
          audit: ctx.audit,
        });
      }
      if (ctx.audit?.result === "PASS" || ctx.audit?.result === "DOWNGRADE") {
        return workItem({
          role: "manager",
          subjectType: "property",
          subjectId: propertyId,
          action: "rank-or-close",
          branch: `${branchBase}-rank`,
          priority: 50,
          prompt: managerRankPrompt(propertyId, meta, ctx.audit),
        });
      }
      return null;

    case "RANKED":
      return workItem({
        role: "manager",
        subjectType: "property",
        subjectId: propertyId,
        action: "publish",
        branch: `${branchBase}-publish`,
        priority: 60,
        prompt: managerPublishPrompt(propertyId, meta),
      });

    case "PUBLISHED":
      return null;

    case "ARCHIVED":
      if (isRescreenDue(meta)) {
        return rescreenWorkItem(propertyId, meta, branchBase);
      }
      return null;

    default:
      return null;
  }
}

function planBuilderWork(task: BuilderTask): WorkItem {
  return workItem({
    role: "builder",
    subjectType: "task",
    subjectId: task.taskId,
    action: "implement-task",
    branch: `agent/${task.taskId.toLowerCase()}-${task.slug}`,
    priority: task.priority,
    prompt: builderPrompt(task),
  });
}

function planScoutWork(task: ScoutTask): WorkItem {
  return workItem({
    role: "scout",
    subjectType: "task",
    subjectId: task.taskId,
    action: "market-sweep",
    branch: `agent/${task.taskId.toLowerCase()}-${task.slug}`,
    priority: task.priority,
    prompt: scoutMarketSweepPrompt(task),
  });
}

function planManagerReview(): WorkItem {
  return workItem({
    role: "manager",
    subjectType: "system",
    subjectId: "pipeline",
    action: "triage-pipeline",
    branch: "agent/manager-triage",
    priority: 5,
    prompt: managerTriagePrompt(),
  });
}

function workItem(input: Omit<WorkItem, "key">): WorkItem {
  return {
    ...input,
    key: `${input.role}:${input.subjectType}:${input.subjectId}:${input.action}`,
  };
}

function analystWorkItem(input: {
  propertyId: string;
  meta: PropertyMeta;
  branchBase: string;
  action: string;
  priority: number;
  mode: "full" | "underwrite-only" | "audit-gaps";
  audit?: PropertyAudit;
}): WorkItem {
  return workItem({
    role: "analyst",
    subjectType: "property",
    subjectId: input.propertyId,
    action: input.action,
    branch: `${input.branchBase}-analyze`,
    priority: input.priority,
    prompt: analystPrompt(
      input.propertyId,
      input.meta,
      input.mode,
      input.audit
    ),
  });
}

function roleHeader(role: AgentRole): string {
  return [
    `You are the ${role.charAt(0).toUpperCase()}${role.slice(1)} agent for RealEstateHunter.`,
    "Read AGENTS.md and your role prompt at `.cursor/agents/" + role + ".md`.",
    "Follow the Cursor Cloud specific instructions in AGENTS.md.",
    "Commit artifacts to the assigned branch and push when complete.",
    "",
  ].join("\n");
}

function isRescreenDue(meta: PropertyMeta, now = new Date()): boolean {
  if (!meta.rescreen_after) {
    return false;
  }
  return new Date(meta.rescreen_after) <= now;
}

function rescreenWorkItem(
  propertyId: string,
  meta: PropertyMeta,
  branchBase: string
): WorkItem {
  return workItem({
    role: "scout",
    subjectType: "property",
    subjectId: propertyId,
    action: "rescreen-listing",
    branch: `${branchBase}-rescreen`,
    priority: 12,
    prompt: rescreenPrompt(propertyId, meta),
  });
}

function scoutPrompt(propertyId: string, meta: PropertyMeta): string {
  return [
    roleHeader("scout"),
    `Property ID: ${propertyId}`,
    meta.listing_url ? `Listing: ${meta.listing_url}` : "",
    meta.address ? `Address: ${meta.address}` : "",
    "",
    "Read data/search-criteria.json — prioritize CONDO BUILDINGS (multi-unit complexes).",
    "Review 40+ listings per market; aim for 10+ RESEARCH total. Do not stop at 3–5.",
    "Screen this listing. Output REJECT or RESEARCH.",
    "Write or update `data/properties/" + propertyId + "/meta.json` with workflow_state SCREENED.",
    "Include building_name and property_type for condos. Reject if gross yield below target_yield_minimum.",
    "On REJECT: set workflow_state ARCHIVED, archive_reason scout_reject, rescreen_after per rescreen_policy.intervals_days.scout_reject, and screening_snapshot.",
  ]
    .filter(Boolean)
    .join("\n");
}

function rescreenPrompt(propertyId: string, meta: PropertyMeta): string {
  const snapshot = meta.screening_snapshot;
  const snapshotLines = snapshot
    ? [
        "",
        "Previous screening snapshot:",
        snapshot.price != null ? `- Price: $${snapshot.price}` : "",
        snapshot.rough_monthly_rent != null
          ? `- Rough rent: $${snapshot.rough_monthly_rent}/mo`
          : "",
        snapshot.rough_gross_yield != null
          ? `- Gross yield: ${(snapshot.rough_gross_yield * 100).toFixed(1)}%`
          : "",
        snapshot.screened_at ? `- Screened at: ${snapshot.screened_at}` : "",
      ].filter(Boolean)
    : [];

  return [
    roleHeader("scout"),
    `Property ID: ${propertyId}`,
    meta.listing_url ? `Listing: ${meta.listing_url}` : "",
    meta.address ? `Address: ${meta.address}` : "",
    meta.archive_reason ? `Archive reason: ${meta.archive_reason}` : "",
    meta.rescreen_count != null ? `Rescreen count: ${meta.rescreen_count}` : "",
    ...snapshotLines,
    "",
    "This listing was previously deemed infeasible. Re-check the live listing.",
    "Read data/search-criteria.json rescreen_policy for intervals and change triggers.",
    "Compare current price/rent/status to screening_snapshot.",
    "",
    "If now passes yield screen: set workflow_state SCREENED, scout_decision RESEARCH, clear archive fields.",
    "If still infeasible: stay ARCHIVED, update screening_snapshot, set new rescreen_after, increment rescreen_count.",
    "If listing inactive/sold: stay ARCHIVED, archive_reason listing_inactive, rescreen_after per listing_inactive interval.",
  ]
    .filter(Boolean)
    .join("\n");
}

function analystPrompt(
  propertyId: string,
  meta: PropertyMeta,
  mode: "full" | "underwrite-only" | "audit-gaps",
  audit?: PropertyAudit
): string {
  const lines = [
    roleHeader("analyst"),
    `Property ID: ${propertyId}`,
    meta.address ? `Address: ${meta.address}` : "",
    "",
  ];

  if (mode === "underwrite-only") {
    lines.push(
      "Evidence file already exists. Complete Phase 2 only:",
      "Read evidence.json, produce underwriting.json with NOI and cap rate.",
      "Do not redo unrelated web research.",
      "Set meta.json workflow_state to UNDERWRITTEN when complete."
    );
  } else if (mode === "audit-gaps") {
    lines.push(
      "Auditor returned NEEDS_RESEARCH. Address only the gaps noted in audit.json findings.",
      audit?.result ? `Current audit result: ${audit.result}` : "",
      "Update evidence.json if needed, re-run underwriting from updated evidence only.",
      "Set meta.json workflow_state to UNDERWRITTEN when complete."
    );
  } else {
    lines.push(
      "Complete both phases in one run:",
      "1. Build evidence.json (Phase 1 — web research).",
      "2. Lock evidence, then produce underwriting.json (Phase 2 — no new web research).",
      "Set meta.json workflow_state to RESEARCHING when you begin.",
      "Set meta.json workflow_state to UNDERWRITTEN when both artifacts are complete.",
      "Never infer HOA or assessments as zero without evidence. Use UNKNOWN when appropriate."
    );
  }

  return lines.filter(Boolean).join("\n");
}

function auditorPrompt(propertyId: string, meta: PropertyMeta): string {
  return [
    roleHeader("auditor"),
    `Property ID: ${propertyId}`,
    "",
    "Validate evidence.json and underwriting.json.",
    "Write audit.json. You may downgrade but not upgrade to VIABLE.",
    "Set meta.json workflow_state to AUDIT.",
  ].join("\n");
}

function managerRankPrompt(
  propertyId: string,
  meta: PropertyMeta,
  audit: PropertyAudit
): string {
  return [
    roleHeader("manager"),
    `Property ID: ${propertyId}`,
    meta.address ? `Address: ${meta.address}` : "",
    "",
    `Audit complete with final_status ${audit.final_status ?? "unknown"}.`,
    "If REJECTED or WATCHLIST (not VIABLE): set workflow_state ARCHIVED with archive_reason audit_reject or watchlist, rescreen_after per rescreen_policy, and screening_snapshot from latest known price/rent.",
    "If VIABLE: rank this opportunity and update meta.json workflow_state to RANKED.",
    "If VIABLE, note that Aaron should be notified.",
  ]
    .filter(Boolean)
    .join("\n");
}

function managerPublishPrompt(propertyId: string, meta: PropertyMeta): string {
  return [
    roleHeader("manager"),
    `Property ID: ${propertyId}`,
    "",
    "Publish this ranked opportunity for the comparison UI.",
    "Set meta.json workflow_state to PUBLISHED.",
  ].join("\n");
}

function managerTriagePrompt(): string {
  return [
    roleHeader("manager"),
    "Review tasks/backlog/, data/properties/, docs/PRODUCT.md, and data/search-criteria.json.",
    "Prioritize Scout condo-building search and volume targets. Tune Builder tasks as needed.",
    "Create or update tasks in tasks/backlog/ as needed.",
    "Do not implement application code.",
  ].join("\n");
}

function builderPrompt(task: BuilderTask): string {
  return [
    roleHeader("builder"),
    `Task: ${task.taskId}`,
    `Task file: ${task.filePath}`,
    "",
    "Move the task file to tasks/active/ while working.",
    "Implement acceptance criteria, add tests, run tests, open a PR.",
    "Move task to tasks/done/ when merged.",
  ].join("\n");
}

function scoutMarketSweepPrompt(task: ScoutTask): string {
  return [
    roleHeader("scout"),
    `Task: ${task.taskId}`,
    `Task file: ${task.filePath}`,
    "",
    "Execute the market-sweep instructions in the task file.",
    "Read data/search-criteria.json for scout_instructions, market_sweep_order, condo_building_search, and volume_targets.",
    "Read data/pipeline-status.json for current progress, market_coverage gaps, and scout_next_actions.",
    "Follow volume targets — review 40+ listings per market; aim for 10+ RESEARCH total. Do not stop early.",
    "Commit reviewed batches as you progress; push directly to main when complete.",
  ].join("\n");
}
