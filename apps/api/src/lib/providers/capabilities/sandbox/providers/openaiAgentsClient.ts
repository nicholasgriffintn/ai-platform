import z from "zod/v4";

import { sleep } from "~/utils/delay";
import { AssistantError, ErrorType } from "~/utils/errors";
import { readResponseTextWithinLimit } from "~/utils/http";

const OPENAI_API_BASE_URL = "https://api.openai.com/v1";
const OPENAI_AGENTS_BETA = "agents=v1";
const MAX_OPENAI_RESULT_BYTES = 2 * 1024 * 1024;
const MAX_OPENAI_DIFF_BYTES = 32 * 1024 * 1024;
const SESSION_DELETE_MAX_ATTEMPTS = 4;

const openAIArtifactSchema = z
  .object({
    id: z.string().min(1),
    path: z.string().min(1),
    turn_id: z.string().min(1),
  })
  .passthrough();
const openAIArtifactListSchema = z.object({ data: z.array(openAIArtifactSchema) }).passthrough();

async function throwOpenAIError(response: Response, operation: string): Promise<never> {
  const detail = await readResponseTextWithinLimit(response, 64 * 1024);

  throw new AssistantError(
    `${operation} failed (${response.status}): ${detail.slice(0, 1000)}`,
    ErrorType.EXTERNAL_API_ERROR,
    502,
  );
}

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

  async downloadArtifacts(params: {
    sessionId: string;
    turnId: string;
  }): Promise<{ result?: string; diff?: string }> {
    const response = await fetch(
      `${OPENAI_API_BASE_URL}/agents/sessions/${encodeURIComponent(params.sessionId)}/artifacts?limit=100&order=desc`,
      { headers: this.headers() },
    );

    if (!response.ok) {
      return throwOpenAIError(response, "OpenAI artifact listing");
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
      return throwOpenAIError(response, "OpenAI artifact download");
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
        },
      );

      if (response.ok || response.status === 404) {
        return;
      }

      if (response.status !== 409 || attempt === SESSION_DELETE_MAX_ATTEMPTS) {
        return throwOpenAIError(response, "OpenAI session deletion");
      }

      await sleep(250 * 2 ** (attempt - 1));
    }
  }
}
