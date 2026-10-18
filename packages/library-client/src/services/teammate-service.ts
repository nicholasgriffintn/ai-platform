import {
  environmentSchema,
  type TeammateResponse,
  type CreateTeammateInput,
  type HireTeammateInput,
  type ListPage,
  type SharedTeammateSummary,
  type UpdateTeammateInput,
  type TeammateConnectionGrant,
  type TeammateConnectionGrantListResponse,
  type UpsertTeammateConnectionGrant,
  type TeammateAutonomyLevel,
  type TeammateToolRule,
  type TeammateContext,
  type TeammateContextScope,
  type TeammateContextStatus,
  type TeammateComputer,
  type TeammateComputerAction,
  type MemoryDocument,
  type UpdateMemoryDocumentInput,
  type RecordTeammateFeedbackInput,
} from "@ngriffin_uk/polychat-schemas";

import { requestJson, resource, withQuery, type ResourceQuery } from "../resource.js";

type MarketplacePage = ListPage<SharedTeammateSummary> & {
  categories: string[];
  tags: string[];
};

const teammates = resource<TeammateResponse>("/teammates");
const contexts = resource<TeammateContext>("/teammates/contexts");
const memoryDocuments = resource<MemoryDocument>("/memory/documents");
const MARKETPLACE_PATH = "/teammates/marketplace";
const marketplace = resource<SharedTeammateSummary>(MARKETPLACE_PATH);

function toTeammatePayload(data: CreateTeammateInput | UpdateTeammateInput) {
  const workspaceId = "workspace_id" in data ? data.workspace_id : undefined;

  return {
    name: data.name,
    description: data.description,
    avatar_url: data.avatar_url || undefined,
    servers: data.servers,
    model: data.model,
    temperature: data.temperature,
    max_steps: data.max_steps,
    system_prompt: data.system_prompt,
    few_shot_examples: data.few_shot_examples,
    enabled_tools: data.enabled_tools,
    skill_ids: data.skill_ids,
    mode: data.mode,
    kind: data.kind,
    workspace_default: data.workspace_default,
    ...(workspaceId ? { workspace_id: workspaceId } : {}),
  };
}

function listMarketplace(query?: ResourceQuery): Promise<MarketplacePage> {
  return requestJson<MarketplacePage>(withQuery(MARKETPLACE_PATH, query), "GET");
}

function environmentPath(contextId: string): string {
  return `/environments/${encodeURIComponent(contextId)}`;
}

function computerActionsPath(contextId: string): string {
  return withQuery(`${environmentPath(contextId)}/actions`, { kind: "teammate_computer" });
}

export class TeammateService {
  getTeammate(teammateId: string): Promise<TeammateResponse> {
    return teammates.get(teammateId);
  }

  listTeammateContexts(teammateId: string): Promise<TeammateContext[]> {
    return teammates.sub<TeammateContext>(teammateId, "contexts").listAll();
  }

  ensureTeammateContext(teammateId: string, scope: TeammateContextScope): Promise<TeammateContext> {
    return teammates.sub<TeammateContext>(teammateId, "contexts").create({ scope });
  }

  updateTeammateContextAutonomy(
    contextId: string,
    autonomyLevel: TeammateAutonomyLevel,
  ): Promise<TeammateContext> {
    return contexts.update(contextId, { autonomyLevel });
  }

  updateTeammateContextStatus(
    contextId: string,
    status: TeammateContextStatus,
  ): Promise<TeammateContext> {
    return contexts.update(contextId, { status });
  }

  updateTeammateContextToolRules(
    contextId: string,
    toolRules: TeammateToolRule[],
  ): Promise<TeammateContext> {
    return contexts.update(contextId, { toolRules });
  }

  updateTeammateContextPause(
    contextId: string,
    pausedUntil: string | null,
  ): Promise<TeammateContext> {
    return contexts.update(contextId, { pausedUntil });
  }

  listTeammateConnectionGrants(contextId: string): Promise<TeammateConnectionGrantListResponse> {
    return contexts.singleton<TeammateConnectionGrantListResponse>(contextId, "connections").get();
  }

  upsertTeammateConnectionGrant(
    contextId: string,
    input: UpsertTeammateConnectionGrant,
  ): Promise<TeammateConnectionGrant> {
    return requestJson<TeammateConnectionGrant>(
      contexts.singleton(contextId, "connections").path,
      "PATCH",
      input,
    );
  }

  async getTeammateContextMemory(contextId: string): Promise<MemoryDocument> {
    const page = await memoryDocuments.list({ teammate_context_id: contextId });
    const [document] = page.data;

    if (!document) {
      throw new Error("Failed to load teammate memory");
    }

    return document;
  }

  async updateTeammateContextMemory(
    contextId: string,
    input: Pick<UpdateMemoryDocumentInput, "content" | "changeNote" | "expectedRevision">,
  ): Promise<MemoryDocument> {
    const current = await this.getTeammateContextMemory(contextId);

    return requestJson<MemoryDocument>(
      withQuery(`${memoryDocuments.path}/${encodeURIComponent(current.name)}`, {
        teammate_context_id: contextId,
      }),
      "PATCH",
      input,
    );
  }

  async getTeammateComputer(contextId: string): Promise<TeammateComputer> {
    const environment = environmentSchema.parse(
      await requestJson<unknown>(
        withQuery(environmentPath(contextId), { kind: "teammate_computer" }),
        "GET",
      ),
    );

    if (environment.kind !== "teammate_computer") {
      throw new Error("Failed to load teammate computer");
    }

    return environment.detail;
  }

  performTeammateComputerAction(contextId: string, action: TeammateComputerAction) {
    return requestJson<{
      computer: TeammateComputer;
      observation?: Record<string, unknown>;
    }>(computerActionsPath(contextId), "POST", action);
  }

  takeOverTeammateComputer(contextId: string, recordTeaching = false) {
    return requestJson<{
      computer: TeammateComputer;
      screenUrl: string;
      expiresAt: string;
      recordingId?: string;
    }>(computerActionsPath(contextId), "POST", {
      action: "takeover",
      record_teaching: recordTeaching,
    });
  }

  viewTeammateComputer(contextId: string) {
    return requestJson<{
      computer: TeammateComputer;
      screenUrl: string;
      expiresAt: string;
      recordingId?: string;
    }>(computerActionsPath(contextId), "POST", { action: "view" });
  }

  releaseTeammateComputer(contextId: string, fence: number): Promise<TeammateComputer> {
    return requestJson<TeammateComputer>(computerActionsPath(contextId), "POST", {
      action: "release",
      fence,
    });
  }

  publishTeammateToWorkspace(teammateId: string, workspaceId: string): Promise<TeammateResponse> {
    return teammates.action<TeammateResponse>(teammateId, "publish", {
      workspace_id: workspaceId,
    });
  }

  async recordTeammateFeedback(
    teammateId: string,
    input: RecordTeammateFeedbackInput,
  ): Promise<void> {
    await teammates.action<unknown>(teammateId, "feedback", input);
  }

  listTeammates(): Promise<TeammateResponse[]> {
    return teammates.listAll();
  }

  async listSharedTeammates({
    category,
    tags,
    search,
    featured,
    limit,
    offset,
    sort_by,
  }: {
    category?: string;
    tags?: string[];
    search?: string;
    featured?: boolean;
    limit?: number;
    offset?: number;
    sort_by?: string;
  } = {}): Promise<SharedTeammateSummary[]> {
    const params = new URLSearchParams();

    if (category) {
      params.append("category", category);
    }

    tags?.forEach((tag) => params.append("tags", tag));

    if (search) {
      params.append("search", search);
    }

    if (featured !== undefined) {
      params.append("featured", String(featured));
    }

    if (limit !== undefined) {
      params.append("limit", String(limit));
    }

    if (offset !== undefined) {
      params.append("offset", String(offset));
    }

    if (sort_by) {
      params.append("sort_by", sort_by);
    }

    const queryString = params.toString();
    const page = await requestJson<MarketplacePage>(
      queryString ? `${MARKETPLACE_PATH}?${queryString}` : MARKETPLACE_PATH,
      "GET",
    );

    return page.data;
  }

  async listFeaturedSharedTeammates(limit = 10): Promise<SharedTeammateSummary[]> {
    return (await listMarketplace({ featured: true, limit })).data;
  }

  installSharedTeammate(sharedTeammateId: string): Promise<unknown> {
    return requestJson<unknown>(
      `/teammates/marketplace/${encodeURIComponent(sharedTeammateId)}/installation`,
      "POST",
      {},
    );
  }

  async getSharedTeammateListingForTeammate(
    teammateId: string,
  ): Promise<SharedTeammateSummary | null> {
    return (await listMarketplace({ teammate_id: teammateId })).data[0] ?? null;
  }

  shareTeammate(
    teammateId: string,
    name: string,
    description?: string | null,
    avatarUrl?: string | null,
    category?: string | null,
    tags?: string[] | null,
  ): Promise<unknown> {
    return marketplace.create({
      agent_id: teammateId,
      name,
      description,
      avatar_url: avatarUrl,
      category,
      tags,
    });
  }

  unshareTeammate(sharedTeammateId: string): Promise<void> {
    return marketplace.delete(sharedTeammateId);
  }

  async getSharedCategories(): Promise<string[]> {
    return (await listMarketplace({ limit: 1 })).categories;
  }

  async getSharedTags(): Promise<string[]> {
    return (await listMarketplace({ limit: 1 })).tags;
  }

  createTeammate(data: CreateTeammateInput): Promise<TeammateResponse> {
    return teammates.create(toTeammatePayload(data));
  }

  hireTeammate(data: HireTeammateInput): Promise<TeammateResponse> {
    return teammates.collectionAction<TeammateResponse>("hire", data);
  }

  updateTeammate(teammateId: string, data: UpdateTeammateInput): Promise<TeammateResponse> {
    return teammates.update(teammateId, toTeammatePayload(data));
  }

  deleteTeammate(teammateId: string): Promise<void> {
    return teammates.delete(teammateId);
  }
}
