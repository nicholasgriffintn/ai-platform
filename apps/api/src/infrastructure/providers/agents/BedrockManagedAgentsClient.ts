import type { BedrockManagedAgentRegion } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { withRetry } from "@ngriffin_uk/polychat-utility-server/retries";
import { AwsClient } from "aws4fetch";

const SESSION_DELETE_MAX_ATTEMPTS = 4;

export interface BedrockManagedAgentsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

function requestFailed(operation: string, response: Response): AssistantError {
  return new AssistantError(
    `Bedrock Managed Agents ${operation} failed (${response.status})`,
    ErrorType.EXTERNAL_API_ERROR,
    response.status === 409 ? 409 : 502,
    { requestId: response.headers.get("x-amzn-requestid") ?? undefined },
  );
}

export class BedrockManagedAgentsClient {
  private readonly signer: AwsClient;
  private readonly baseUrl: string;

  constructor(region: BedrockManagedAgentRegion, credentials: BedrockManagedAgentsCredentials) {
    this.signer = new AwsClient({
      ...credentials,
      service: "bedrock-mantle",
      region,
      retries: 0,
    });
    this.baseUrl = `https://bedrock-mantle.${region}.api.aws/openai/v1/agents/sessions`;
  }

  async createSession(body: Record<string, unknown>): Promise<ReadableStream<Uint8Array>> {
    const response = await this.signer.fetch(this.baseUrl, {
      method: "POST",
      headers: { Accept: "text/event-stream", "Content-Type": "application/json" },
      body: JSON.stringify(body),
      redirect: "manual",
    });

    if (!response.ok || !response.body) {
      await response.body?.cancel();
      throw requestFailed("session start", response);
    }

    return response.body;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await withRetry(
      async () => {
        const response = await this.signer.fetch(
          `${this.baseUrl}/${encodeURIComponent(sessionId)}`,
          { method: "DELETE", redirect: "manual", signal: AbortSignal.timeout(30_000) },
        );

        await response.body?.cancel();

        if (!response.ok && response.status !== 404) {
          throw requestFailed("session deletion", response);
        }
      },
      {
        maxAttempts: SESSION_DELETE_MAX_ATTEMPTS,
        baseDelayMs: 250,
        isRetryableError: (error) => error instanceof AssistantError && error.statusCode === 409,
      },
    );
  }
}
