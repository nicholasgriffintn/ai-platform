import { openAIArtifactListSchema } from "@ngriffin_uk/polychat-schemas";
import { sleep } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { readResponseTextWithinLimit } from "@ngriffin_uk/polychat-utility-server/http";

import { throwExternalApiResponseError } from "~/lib/external-api-errors";

const OPENAI_API_BASE_URL = "https://api.openai.com/v1";
const OPENAI_AGENTS_BETA = "agents=v1";
const MAX_OPENAI_RESULT_BYTES = 2 * 1024 * 1024;
const MAX_OPENAI_DIFF_BYTES = 32 * 1024 * 1024;
const SESSION_DELETE_MAX_ATTEMPTS = 4;

export class OpenAIAgentsClient {
  constructor(private readonly apiKey: string) {}

  private headers(json = false): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "OpenAI-Beta": OPENAI_AGENTS_BETA,
      ...(json ? { "Content-Type": "application/json" } : {}),
    };
  }

  async createSession(body: Record<string, unknown>): Promise<Response> {
    return fetch(`${OPENAI_API_BASE_URL}/agents/sessions`, {
      method: "POST",
      headers: {
        ...this.headers(true),
        Accept: "text/event-stream",
      },
      body: JSON.stringify(body),
    });
  }

  async createManagedSession(body: Record<string, unknown>): Promise<unknown> {
    return this.jsonRequest("/agents/sessions", "POST", body);
  }

  async retrieveSession(sessionId: string): Promise<unknown> {
    return this.jsonRequest(`/agents/sessions/${encodeURIComponent(sessionId)}`);
  }

  async listSessions(after?: string): Promise<unknown> {
    const query = new URLSearchParams({ limit: "100", order: "desc", ...(after ? { after } : {}) });

    return this.jsonRequest(`/agents/sessions?${query}`);
  }

  async listSessionTurns(sessionId: string): Promise<unknown> {
    return this.jsonRequest(
      `/agents/sessions/${encodeURIComponent(sessionId)}/turns?limit=100&order=desc`,
    );
  }

  async listSessionItems(sessionId: string, after?: string): Promise<unknown> {
    const query = new URLSearchParams({ limit: "100", order: "asc", ...(after ? { after } : {}) });

    return this.jsonRequest(`/agents/sessions/${encodeURIComponent(sessionId)}/items?${query}`);
  }

  async submitSessionEvents(
    sessionId: string,
    events: Record<string, unknown>[],
    idempotencyKey?: string,
  ): Promise<void> {
    await this.jsonRequest(
      `/agents/sessions/${encodeURIComponent(sessionId)}/events`,
      "POST",
      { events },
      idempotencyKey,
    );
  }

  private async jsonRequest(
    path: string,
    method = "GET",
    body?: Record<string, unknown>,
    idempotencyKey?: string,
  ): Promise<unknown> {
    const response = await fetch(`${OPENAI_API_BASE_URL}${path}`, {
      method,
      headers: {
        ...this.headers(body !== undefined),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      await response.body?.cancel();
      throw new AssistantError(
        `OpenAI Agents request failed (${response.status}). Refresh the session before retrying.`,
        ErrorType.EXTERNAL_API_ERROR,
        response.status === 404 || response.status === 409 ? response.status : 502,
      );
    }

    if (response.status === 202 || response.status === 204) {
      await response.body?.cancel();

      return null;
    }

    return JSON.parse(await readResponseTextWithinLimit(response, 16 * 1024 * 1024));
  }

  async downloadArtifacts(params: {
    sessionId: string;
    turnId: string;
  }): Promise<{ result?: string; diff?: string }> {
    const response = await fetch(
      `${OPENAI_API_BASE_URL}/agents/sessions/${encodeURIComponent(params.sessionId)}/artifacts?limit=100&order=desc`,
      { headers: this.headers() },
    );

    if (!response.ok) {
      return throwExternalApiResponseError(response, "OpenAI artifact listing");
    }

    const artifacts = openAIArtifactListSchema
      .parse(await response.json())
      .data.filter((artifact) => artifact.turn_id === params.turnId);
    const resultArtifact = artifacts.find(
      (artifact) => artifact.path === "/workspace/outputs/result.json",
    );
    const diffArtifact = artifacts.find(
      (artifact) => artifact.path === "/workspace/outputs/diff.patch",
    );

    const [result, diff] = await Promise.all([
      resultArtifact
        ? this.downloadArtifact(params.sessionId, resultArtifact.id, MAX_OPENAI_RESULT_BYTES)
        : undefined,
      diffArtifact
        ? this.downloadArtifact(params.sessionId, diffArtifact.id, MAX_OPENAI_DIFF_BYTES)
        : undefined,
    ]);

    return { result, diff };
  }

  private async downloadArtifact(
    sessionId: string,
    artifactId: string,
    maxBytes: number,
  ): Promise<string> {
    const response = await fetch(
      `${OPENAI_API_BASE_URL}/agents/sessions/${encodeURIComponent(sessionId)}/artifacts/${encodeURIComponent(artifactId)}/content`,
      { headers: this.headers() },
    );

    if (!response.ok) {
      return throwExternalApiResponseError(response, "OpenAI artifact download");
    }

    return readResponseTextWithinLimit(response, maxBytes);
  }

  async deleteSession(sessionId: string): Promise<void> {
    for (let attempt = 1; attempt <= SESSION_DELETE_MAX_ATTEMPTS; attempt += 1) {
      const response = await fetch(
        `${OPENAI_API_BASE_URL}/agents/sessions/${encodeURIComponent(sessionId)}`,
        {
          method: "DELETE",
          headers: this.headers(),
          redirect: "error",
          signal: AbortSignal.timeout(30_000),
        },
      );

      if (response.ok || response.status === 404) {
        return;
      }

      if (response.status !== 409 || attempt === SESSION_DELETE_MAX_ATTEMPTS) {
        return throwExternalApiResponseError(response, "OpenAI session deletion");
      }

      await sleep(250 * 2 ** (attempt - 1));
    }
  }
}
