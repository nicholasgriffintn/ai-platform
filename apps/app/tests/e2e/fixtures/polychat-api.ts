import {
  authoredSkillDocumentSchema,
  authoredSkillHistoryResponseSchema,
  authoredSkillVersionedDocumentSchema,
  conversationBranchesResponseSchema,
  usageBalanceResponseSchema,
  usageEventsResponseSchema,
  usageSummaryResponseSchema,
  workspaceUsageSummaryResponseSchema,
  type AuthoredSkillDocument,
  type AuthoredSkillHistoryResponse,
} from "@ngriffin_uk/polychat-schemas";
import type { APIRequestContext, APIResponse } from "@playwright/test";

const API_BASE_URL = "http://localhost:8787";
const BROWSER_REQUEST_HEADERS = { origin: "http://localhost:5173" };

async function requireSuccessfulResponse(response: APIResponse, operation: string): Promise<void> {
  if (response.ok()) {
    return;
  }

  throw new Error(`${operation} failed (${response.status()}): ${await response.text()}`);
}

function skillDocument(name: string, instructions: string): string {
  return `---\nname: ${name}\ndescription: Exercise the authored skill release lifecycle.\n---\n\n# Instructions\n${instructions}`;
}

export class PolychatApi {
  constructor(private readonly request: APIRequestContext) {}

  private async exerciseSkillRevisionLifecycle(
    directoryPath: string,
    input: {
      name: string;
      initialInstructions: string;
      revisedInstructions: string;
      resourceContent: string;
    },
  ) {
    const operationScope = directoryPath.startsWith("/projects/") ? "project" : "personal";
    const directoryUrl = `${API_BASE_URL}${directoryPath}`;
    const resources = [
      {
        path: "references/evidence.md",
        content: input.resourceContent,
      },
    ];
    const createResponse = await this.request.post(directoryUrl, {
      headers: BROWSER_REQUEST_HEADERS,
      data: {
        content: skillDocument(input.name, input.initialInstructions),
        resources,
      },
    });

    await requireSuccessfulResponse(createResponse, `Create ${operationScope} skill`);
    const created = authoredSkillDocumentSchema.parse(await createResponse.json());
    const skillUrl = `${directoryUrl}/${created.name}`;

    const historyResponse = await this.request.get(`${skillUrl}/history`);

    await requireSuccessfulResponse(historyResponse, `Load ${operationScope} skill history`);
    const history = authoredSkillHistoryResponseSchema.parse(await historyResponse.json());
    const initialRevision = history.revisions.at(-1);

    if (!initialRevision) {
      throw new Error(`Created ${operationScope} skill has no initial revision`);
    }

    const draftResponse = await this.request.put(`${skillUrl}/draft`, {
      headers: BROWSER_REQUEST_HEADERS,
      data: {
        content: skillDocument(input.name, input.revisedInstructions),
        resources,
        expectedStateVersion: history.state.stateVersion,
        changeNote: "Revise release instructions",
      },
    });

    await requireSuccessfulResponse(draftResponse, `Save ${operationScope} skill draft`);
    const draft = authoredSkillVersionedDocumentSchema.parse(await draftResponse.json());

    const promoteResponse = await this.request.post(`${skillUrl}/promote`, {
      headers: BROWSER_REQUEST_HEADERS,
      data: {
        revisionId: draft.revision.id,
        expectedStateVersion: draft.state.stateVersion,
      },
    });

    await requireSuccessfulResponse(promoteResponse, `Promote ${operationScope} skill draft`);
    const promoted = authoredSkillVersionedDocumentSchema.parse(await promoteResponse.json());

    const rollbackResponse = await this.request.post(`${skillUrl}/rollback`, {
      headers: BROWSER_REQUEST_HEADERS,
      data: {
        revisionId: initialRevision.id,
        expectedStateVersion: promoted.state.stateVersion,
        changeNote: "Restore stable release instructions",
      },
    });

    await requireSuccessfulResponse(rollbackResponse, `Roll ${operationScope} skill back`);
    const rolledBack = authoredSkillVersionedDocumentSchema.parse(await rollbackResponse.json());

    const revisionResponse = await this.request.get(`${skillUrl}/revisions/${initialRevision.id}`);

    await requireSuccessfulResponse(revisionResponse, `Load ${operationScope} skill revision`);
    const retrieved = authoredSkillVersionedDocumentSchema.parse(await revisionResponse.json());

    const archiveResponse = await this.request.delete(skillUrl, {
      headers: BROWSER_REQUEST_HEADERS,
    });

    await requireSuccessfulResponse(archiveResponse, `Archive ${operationScope} skill`);
    const archivedStatus = (await this.request.get(skillUrl)).status();

    const recreateResponse = await this.request.post(directoryUrl, {
      headers: BROWSER_REQUEST_HEADERS,
      data: {
        content: skillDocument(input.name, input.initialInstructions),
        resources,
      },
    });

    await requireSuccessfulResponse(
      recreateResponse,
      `Reuse archived ${operationScope} skill name`,
    );
    const recreated = authoredSkillDocumentSchema.parse(await recreateResponse.json());

    const cleanupResponse = await this.request.delete(`${directoryUrl}/${recreated.name}`, {
      headers: BROWSER_REQUEST_HEADERS,
    });

    await requireSuccessfulResponse(cleanupResponse, `Clean up recreated ${operationScope} skill`);

    return {
      initialRevision,
      draft,
      promoted,
      rolledBack,
      retrieved,
      archivedStatus,
      recreated,
    };
  }

  exercisePersonalSkillRevisionLifecycle(input: {
    name: string;
    initialInstructions: string;
    revisedInstructions: string;
    resourceContent: string;
  }) {
    return this.exerciseSkillRevisionLifecycle("/skills/documents", input);
  }

  exerciseProjectSkillRevisionLifecycle(
    projectId: string,
    input: {
      name: string;
      initialInstructions: string;
      revisedInstructions: string;
      resourceContent: string;
    },
  ) {
    return this.exerciseSkillRevisionLifecycle(`/projects/${projectId}/skills`, input);
  }

  async createProjectSkill(
    projectId: string,
    name: string,
    instructions: string,
  ): Promise<AuthoredSkillDocument> {
    const response = await this.request.post(`${API_BASE_URL}/projects/${projectId}/skills`, {
      headers: BROWSER_REQUEST_HEADERS,
      data: { content: skillDocument(name, instructions) },
    });

    await requireSuccessfulResponse(response, "Create project skill");

    return authoredSkillDocumentSchema.parse(await response.json());
  }

  async getProjectSkill(projectId: string, name: string): Promise<AuthoredSkillDocument> {
    const response = await this.request.get(`${API_BASE_URL}/projects/${projectId}/skills/${name}`);

    await requireSuccessfulResponse(response, "Load project skill");

    return authoredSkillDocumentSchema.parse(await response.json());
  }

  async getProjectSkillHistory(
    projectId: string,
    name: string,
  ): Promise<AuthoredSkillHistoryResponse> {
    const response = await this.request.get(
      `${API_BASE_URL}/projects/${projectId}/skills/${name}/history`,
    );

    await requireSuccessfulResponse(response, "Load project skill history");

    return authoredSkillHistoryResponseSchema.parse(await response.json());
  }

  async projectSkillHistoryStatus(projectId: string, name: string): Promise<number> {
    return (
      await this.request.get(`${API_BASE_URL}/projects/${projectId}/skills/${name}/history`)
    ).status();
  }

  async projectSkillRevisionStatus(
    projectId: string,
    name: string,
    revisionId: string,
  ): Promise<number> {
    return (
      await this.request.get(
        `${API_BASE_URL}/projects/${projectId}/skills/${name}/revisions/${revisionId}`,
      )
    ).status();
  }

  async deleteProjectSkill(projectId: string, name: string): Promise<void> {
    const response = await this.request.delete(
      `${API_BASE_URL}/projects/${projectId}/skills/${name}`,
      { headers: BROWSER_REQUEST_HEADERS },
    );

    await requireSuccessfulResponse(response, "Delete project skill");
  }

  async projectUpdateStatus(projectId: string, defaultRouterMode: string): Promise<number> {
    return (
      await this.request.put(`${API_BASE_URL}/projects/${projectId}`, {
        headers: BROWSER_REQUEST_HEADERS,
        data: { defaultRouterMode },
      })
    ).status();
  }

  async getWorkspaceUsage(workspaceId: string, period?: string) {
    const query = period ? `?period=${encodeURIComponent(period)}` : "";
    const response = await this.request.get(
      `${API_BASE_URL}/workspaces/${workspaceId}/usage${query}`,
    );

    await requireSuccessfulResponse(response, "Load workspace usage");

    return workspaceUsageSummaryResponseSchema.parse(await response.json());
  }

  async workspaceUsageStatus(workspaceId: string): Promise<number> {
    return (await this.request.get(`${API_BASE_URL}/workspaces/${workspaceId}/usage`)).status();
  }

  async getAccountUsageSummary() {
    const response = await this.request.get(`${API_BASE_URL}/user/usage/summary`);

    await requireSuccessfulResponse(response, "Load account usage summary");

    return usageSummaryResponseSchema.parse(await response.json());
  }

  async getAccountUsageBalance() {
    const response = await this.request.get(`${API_BASE_URL}/user/usage/balance`);

    await requireSuccessfulResponse(response, "Load account usage balance");

    return usageBalanceResponseSchema.parse(await response.json());
  }

  async getAccountUsageEvents(options: { cursor?: string; limit?: number; source?: string } = {}) {
    const search = new URLSearchParams();
    const queryOptions = [
      ["cursor", options.cursor],
      ["limit", options.limit === undefined ? undefined : String(options.limit)],
      ["source", options.source],
    ] as const;

    for (const [key, value] of queryOptions) {
      if (value !== undefined) {
        search.set(key, value);
      }
    }

    const query = search.size > 0 ? `?${search}` : "";
    const response = await this.request.get(`${API_BASE_URL}/user/usage/events${query}`);

    await requireSuccessfulResponse(response, "Load account usage events");

    return usageEventsResponseSchema.parse(await response.json());
  }

  async accountUsageEventsStatus(): Promise<number> {
    return (await this.request.get(`${API_BASE_URL}/user/usage/events`)).status();
  }

  async getAnonymousUsageState(completionId: string) {
    const response = await this.request.get(
      `${API_BASE_URL}/__e2e-persona-state?completion_id=${encodeURIComponent(completionId)}`,
    );

    await requireSuccessfulResponse(response, "Load anonymous E2E state");

    return (await response.json()) as {
      credit_period: string;
      spent_credit_micros: number;
      reserved_credit_micros: number;
      event_count: number;
    };
  }

  async speechStatus(provider?: "elevenlabs" | "melotts"): Promise<number> {
    return (
      await this.request.post(`${API_BASE_URL}/audio/speech`, {
        headers: BROWSER_REQUEST_HEADERS,
        data: {
          input: "Read the release validation sentence.",
          ...(provider ? { provider } : {}),
          store: false,
        },
      })
    ).status();
  }

  async transcriptionStatus(): Promise<number> {
    return (
      await this.request.post(`${API_BASE_URL}/audio/transcribe`, {
        headers: BROWSER_REQUEST_HEADERS,
        multipart: {
          audio: {
            name: "release-validation.webm",
            mimeType: "audio/webm",
            buffer: Buffer.from("release audio"),
          },
        },
      })
    ).status();
  }

  async completionStatus(body: Record<string, unknown>): Promise<number> {
    return (
      await this.request.post(`${API_BASE_URL}/chat/completions`, {
        headers: BROWSER_REQUEST_HEADERS,
        data: body,
      })
    ).status();
  }

  async createCheckoutSession(input: { planId: string; successUrl: string; cancelUrl: string }) {
    const response = await this.request.post(`${API_BASE_URL}/stripe/checkout`, {
      headers: BROWSER_REQUEST_HEADERS,
      data: {
        plan_id: input.planId,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
      },
    });

    await requireSuccessfulResponse(response, "Create Stripe Checkout session");

    return (await response.json()) as { session_id: string; url: string };
  }

  async checkoutStatus(input: { planId: string; successUrl: string; cancelUrl: string }) {
    return (
      await this.request.post(`${API_BASE_URL}/stripe/checkout`, {
        headers: BROWSER_REQUEST_HEADERS,
        data: {
          plan_id: input.planId,
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
        },
      })
    ).status();
  }

  async createBillingPortalSession(returnUrl: string) {
    const response = await this.request.post(`${API_BASE_URL}/stripe/portal`, {
      headers: BROWSER_REQUEST_HEADERS,
      data: { return_url: returnUrl },
    });

    await requireSuccessfulResponse(response, "Create Stripe billing portal session");

    return (await response.json()) as { url: string };
  }

  async billingPortalStatus(returnUrl: string) {
    return (
      await this.request.post(`${API_BASE_URL}/stripe/portal`, {
        headers: BROWSER_REQUEST_HEADERS,
        data: { return_url: returnUrl },
      })
    ).status();
  }

  async updateConversation(
    conversationId: string,
    updates: { title?: string; archived?: boolean },
  ): Promise<void> {
    const response = await this.request.put(`${API_BASE_URL}/chat/completions/${conversationId}`, {
      headers: BROWSER_REQUEST_HEADERS,
      data: updates,
    });

    await requireSuccessfulResponse(response, "Update conversation");
  }

  async getConversationBranches(conversationId: string) {
    const response = await this.request.get(
      `${API_BASE_URL}/chat/completions/${conversationId}/branches`,
    );

    await requireSuccessfulResponse(response, "Load conversation branches");

    return conversationBranchesResponseSchema.parse(await response.json());
  }

  async conversationBranchesStatus(conversationId: string): Promise<number> {
    return (
      await this.request.get(`${API_BASE_URL}/chat/completions/${conversationId}/branches`)
    ).status();
  }
}
