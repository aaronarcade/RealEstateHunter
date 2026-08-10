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
  | "researcher"
  | "underwriter"
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

export interface PlannerInput {
  properties: PropertyContext[];
  builderTasks: BuilderTask[];
  pendingManagerReview: boolean;
}

export function planWork(input: PlannerInput): WorkItem[] {
  const items: WorkItem[] = [];

  for (const property of input.properties) {
    const next = planPropertyWork(property);
    if (next) {
      items.push(next);
    }
  }

  for (const task of input.builderTasks) {
    items.push(planBuilderWork(task));
  }

  if (input.pendingManagerReview) {
    items.push(planManagerReview());
  }

  return items.sort((a, b) => a.priority - b.priority);
}

function planPropertyWork(ctx: PropertyContext): WorkItem | null {
  const { propertyId, meta } = ctx;
  const branchBase = `agent/${propertyId}`;

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
      if (!ctx.hasEvidence) {
        return workItem({
          role: "researcher",
          subjectType: "property",
          subjectId: propertyId,
          action: "build-evidence",
          branch: `${branchBase}-research`,
          priority: 20,
          prompt: researcherPrompt(propertyId, meta),
        });
      }
      return null;

    case "RESEARCHING":
      return workItem({
        role: "researcher",
        subjectType: "property",
        subjectId: propertyId,
        action: "complete-evidence",
        branch: `${branchBase}-research`,
        priority: 20,
        prompt: researcherPrompt(propertyId, meta),
      });

    case "READY_FOR_UNDERWRITING":
      if (!ctx.hasEvidence) {
        return workItem({
          role: "researcher",
          subjectType: "property",
          subjectId: propertyId,
          action: "build-evidence",
          branch: `${branchBase}-research`,
          priority: 15,
          prompt: researcherPrompt(propertyId, meta),
        });
      }
      return workItem({
        role: "underwriter",
        subjectType: "property",
        subjectId: propertyId,
        action: "underwrite",
        branch: `${branchBase}-underwrite`,
        priority: 30,
        prompt: underwriterPrompt(propertyId, meta),
      });

    case "UNDERWRITTEN":
      if (!ctx.hasUnderwriting) {
        return workItem({
          role: "underwriter",
          subjectType: "property",
          subjectId: propertyId,
          action: "underwrite",
          branch: `${branchBase}-underwrite`,
          priority: 30,
          prompt: underwriterPrompt(propertyId, meta),
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
        return workItem({
          role: "researcher",
          subjectType: "property",
          subjectId: propertyId,
          action: "fill-audit-gaps",
          branch: `${branchBase}-research`,
          priority: 15,
          prompt: researcherGapPrompt(propertyId, meta, ctx.audit),
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

function researcherPrompt(propertyId: string, meta: PropertyMeta): string {
  return [
    roleHeader("researcher"),
    `Property ID: ${propertyId}`,
    meta.address ? `Address: ${meta.address}` : "",
    "",
    "Build a complete `evidence.json` for this property using schemas in `schemas/`.",
    "Update `meta.json` workflow_state to READY_FOR_UNDERWRITING when complete.",
    "Never infer HOA or assessments as zero without evidence. Use UNKNOWN when appropriate.",
  ]
    .filter(Boolean)
    .join("\n");
}

function researcherGapPrompt(
  propertyId: string,
  meta: PropertyMeta,
  audit: PropertyAudit
): string {
  return [
    roleHeader("researcher"),
    `Property ID: ${propertyId}`,
    meta.address ? `Address: ${meta.address}` : "",
    "",
    "Auditor returned NEEDS_RESEARCH. Address only the gaps noted in audit.json findings.",
    `Current audit result: ${audit.result ?? "NEEDS_RESEARCH"}`,
    "Update evidence.json and set meta.json workflow_state back to READY_FOR_UNDERWRITING.",
  ]
    .filter(Boolean)
    .join("\n");
}

function underwriterPrompt(propertyId: string, meta: PropertyMeta): string {
  return [
    roleHeader("underwriter"),
    `Property ID: ${propertyId}`,
    "",
    "Read evidence.json and produce underwriting.json with NOI and cap rate.",
    "Propose VIABLE, WATCHLIST, or REJECTED per docs/PRODUCT.md.",
    "Set meta.json workflow_state to UNDERWRITTEN.",
  ].join("\n");
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
