export interface RoleConfig {
  enabled: boolean;
  maxConcurrent: number;
  /** Override global autoCreatePR for this role. */
  autoCreatePR?: boolean;
  /** Override global skipReviewerRequest for this role. */
  skipReviewerRequest?: boolean;
}

export interface OrchestratorConfig {
  repoUrl: string;
  startingRef: string;
  cloudEnvName: string | null;
  /** Cloud agent model id (e.g. "auto", "composer-2.5"). See GET /v1/models. */
  modelId: string;
  maxConcurrentAgents: number;
  autoCreatePR: boolean;
  skipReviewerRequest: boolean;
  roles: Record<string, RoleConfig>;
}

export interface CreateAgentRequest {
  promptText: string;
  branch: string;
  name: string;
  autoCreatePR: boolean;
  skipReviewerRequest: boolean;
}

export interface CreateAgentResponse {
  agentId: string;
  runId: string;
  agentUrl?: string;
  agentStatus: string;
  runStatus: string;
}

export interface AgentSummary {
  id: string;
  status: string;
  latestRunId?: string;
  url?: string;
}

export interface RunSummary {
  id: string;
  status: string;
}

export class CursorCloudClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = "https://api.cursor.com"
  ) {}

  async createAgent(
    config: OrchestratorConfig,
    request: CreateAgentRequest
  ): Promise<CreateAgentResponse> {
    const body: Record<string, unknown> = {
      name: request.name.slice(0, 100),
      prompt: {
        text: [
          `Target branch: \`${request.branch}\` (create from \`${config.startingRef}\` if it does not exist).`,
          "",
          request.promptText,
        ].join("\n"),
      },
      repos: [
        {
          url: config.repoUrl,
          startingRef: config.startingRef,
        },
      ],
      autoCreatePR: request.autoCreatePR,
      skipReviewerRequest: request.skipReviewerRequest,
      model: {
        id: config.modelId,
      },
    };

    if (config.cloudEnvName) {
      body.env = { type: "cloud", name: config.cloudEnvName };
      delete body.repos;
    }

    const response = await this.request("POST", "/v1/agents", body);
    const agent = response.agent as Record<string, unknown>;
    const run = response.run as Record<string, unknown>;

    return {
      agentId: String(agent.id),
      runId: String(run.id),
      agentUrl: agent.url ? String(agent.url) : undefined,
      agentStatus: String(agent.status),
      runStatus: String(run.status),
    };
  }

  async getAgent(agentId: string): Promise<AgentSummary> {
    const response = await this.request("GET", `/v1/agents/${agentId}`);
    return {
      id: String(response.id),
      status: String(response.status),
      latestRunId: response.latestRunId
        ? String(response.latestRunId)
        : undefined,
      url: response.url ? String(response.url) : undefined,
    };
  }

  async getRun(runId: string): Promise<RunSummary> {
    const response = await this.request("GET", `/v1/runs/${runId}`);
    return {
      id: String(response.id),
      status: String(response.status),
    };
  }

  private async request(
    method: string,
    pathname: string,
    body?: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const headers: Record<string, string> = {
      Authorization: `Basic ${Buffer.from(`${this.apiKey}:`).toString("base64")}`,
    };

    if (body) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(`${this.baseUrl}${pathname}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    let payload: Record<string, unknown> = {};
    if (text) {
      payload = JSON.parse(text) as Record<string, unknown>;
    }

    if (!response.ok) {
      const message =
        (payload.message as string | undefined) ??
        (payload.error as string | undefined) ??
        text ??
        response.statusText;
      throw new Error(`Cursor API ${method} ${pathname} failed (${response.status}): ${message}`);
    }

    return payload;
  }
}

export function loadConfig(configPath: string, raw: string): OrchestratorConfig {
  const parsed = JSON.parse(raw) as Partial<OrchestratorConfig>;
  if (!parsed.repoUrl) {
    throw new Error(`Missing repoUrl in ${configPath}`);
  }

  return {
    repoUrl: parsed.repoUrl,
    startingRef: parsed.startingRef ?? "main",
    cloudEnvName: parsed.cloudEnvName ?? null,
    modelId: parsed.modelId ?? "auto",
    maxConcurrentAgents: parsed.maxConcurrentAgents ?? 3,
    autoCreatePR: parsed.autoCreatePR ?? true,
    skipReviewerRequest: parsed.skipReviewerRequest ?? true,
    roles: parsed.roles ?? {},
  };
}

export function isRoleEnabled(
  config: OrchestratorConfig,
  role: string
): boolean {
  const roleConfig = config.roles[role];
  if (!roleConfig) {
    return true;
  }
  return roleConfig.enabled !== false;
}

export function countActiveForRole(
  entries: Array<{ role: string; status: string }>,
  role: string
): number {
  return entries.filter(
    (entry) => entry.role === role && entry.status === "ACTIVE"
  ).length;
}

export function roleHasCapacity(
  config: OrchestratorConfig,
  role: string,
  activeCount: number
): boolean {
  const roleConfig = config.roles[role];
  const max = roleConfig?.maxConcurrent ?? config.maxConcurrentAgents;
  return activeCount < max;
}

export function resolveRoleAutoCreatePR(
  config: OrchestratorConfig,
  role: string
): boolean {
  const roleConfig = config.roles[role];
  if (roleConfig?.autoCreatePR !== undefined) {
    return roleConfig.autoCreatePR;
  }
  return config.autoCreatePR;
}

export function resolveRoleSkipReviewerRequest(
  config: OrchestratorConfig,
  role: string
): boolean {
  const roleConfig = config.roles[role];
  if (roleConfig?.skipReviewerRequest !== undefined) {
    return roleConfig.skipReviewerRequest;
  }
  return config.skipReviewerRequest;
}

/** Property pipeline roles push to main; Builder keeps feature branches + PR. */
export function resolveAgentBranch(
  config: OrchestratorConfig,
  role: string,
  plannedBranch: string
): string {
  if (resolveRoleAutoCreatePR(config, role)) {
    return plannedBranch;
  }
  return config.startingRef;
}

export function directMainPushInstructions(
  config: OrchestratorConfig
): string {
  return [
    "",
    "## Push instructions",
    `Commit and push directly to \`${config.startingRef}\`. Do not create a feature branch or open a PR.`,
    "Scope changes to your assigned property or manager task only.",
  ].join("\n");
}
