import {
  bedrockManagedAgentRegionSchema,
  bedrockManagedAgentSessionSchema,
  bedrockManagedAgentSessionsPageSchema,
  createManagedAgentSessionSchema,
  managedAgentIdSchema,
  managedAgentItemsSchema,
  managedAgentMessageSchema,
  managedAgentPageQuerySchema,
  type BedrockManagedAgentRegion,
  type BedrockManagedAgentSession,
  type BedrockManagedAgentSessionsPage,
  type CreateManagedAgentSession,
  type ManagedAgentItems,
  type ManagedAgentPageQuery,
} from "@ngriffin_uk/polychat-schemas";
import { toQueryString } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { AwsClient } from "aws4fetch";

import { validateAwsCredentials, type AwsCredentials } from "../../utils/awsCredentials.js";
import { readValidatedProviderResponse } from "../../utils/schemaResponse.js";

export interface BedrockManagedAgentsClientOptions {
  region: BedrockManagedAgentRegion;
  credentials: () => Promise<AwsCredentials>;
}

export class BedrockManagedAgentsClient {
  private readonly region: BedrockManagedAgentRegion;
  private readonly baseUrl: string;

  constructor(private readonly options: BedrockManagedAgentsClientOptions) {
    this.region = bedrockManagedAgentRegionSchema.parse(options.region);
    this.baseUrl = `https://bedrock-mantle.${this.region}.api.aws/openai/v1/agents/sessions`;
  }

  private async request(
    path: string,
    method: string,
    body?: object,
    signal?: AbortSignal,
    stream = false,
  ): Promise<Response> {
    const credentials = validateAwsCredentials(await this.options.credentials());
    const signer = new AwsClient({
      accessKeyId: credentials.accessKey,
      secretAccessKey: credentials.secretKey,
      sessionToken: credentials.sessionToken,
      service: "bedrock-mantle",
      region: this.region,
      retries: 0,
    });
    const request = await signer.sign(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Accept: stream ? "text/event-stream" : "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: stream
        ? signal
        : signal
          ? AbortSignal.any([signal, AbortSignal.timeout(30_000)])
          : AbortSignal.timeout(30_000),
      redirect: "error",
    });
    const response = await fetch(request);

    if (!response.ok) {
      await response.body?.cancel();
      const status = [400, 401, 403, 404, 409, 429].includes(response.status)
        ? response.status
        : 502;

      throw new AssistantError(
        `Bedrock Managed Agents request failed (${response.status})`,
        ErrorType.EXTERNAL_API_ERROR,
        status,
        { requestId: response.headers.get("x-amzn-requestid") ?? undefined },
      );
    }

    return response;
  }

  async createSession(
    input: CreateManagedAgentSession,
    signal?: AbortSignal,
  ): Promise<BedrockManagedAgentSession> {
    const body = createManagedAgentSessionSchema.parse(input);

    if (body.environment.runtime_arn.split(":")[3] !== this.region) {
      throw new AssistantError(
        "The Runtime and endpoint regions must match",
        ErrorType.PARAMS_ERROR,
      );
    }

    return readValidatedProviderResponse(
      await this.request("", "POST", { ...body, stream: false }, signal),
      bedrockManagedAgentSessionSchema,
      1024 * 1024,
      "Bedrock Managed Agents",
    );
  }

  async listSessions(
    query: Partial<ManagedAgentPageQuery> = {},
    signal?: AbortSignal,
  ): Promise<BedrockManagedAgentSessionsPage> {
    const page = managedAgentPageQuerySchema.parse(query);

    return readValidatedProviderResponse(
      await this.request(toQueryString(page), "GET", undefined, signal),
      bedrockManagedAgentSessionsPageSchema,
      8 * 1024 * 1024,
      "Bedrock Managed Agents",
    );
  }

  async retrieveSession(
    sessionId: string,
    signal?: AbortSignal,
  ): Promise<BedrockManagedAgentSession> {
    const id = managedAgentIdSchema.parse(sessionId);

    return readValidatedProviderResponse(
      await this.request(`/${encodeURIComponent(id)}`, "GET", undefined, signal),
      bedrockManagedAgentSessionSchema,
      1024 * 1024,
      "Bedrock Managed Agents",
    );
  }

  async sendMessage(sessionId: string, text: string, signal?: AbortSignal): Promise<void> {
    const id = managedAgentIdSchema.parse(sessionId);
    const message = managedAgentMessageSchema.parse({ text });
    const response = await this.request(
      `/${encodeURIComponent(id)}/events`,
      "POST",
      {
        events: [
          {
            type: "agent.session.input.message",
            input: [{ role: "user", content: [{ type: "input_text", text: message.text }] }],
          },
        ],
      },
      signal,
    );

    await response.body?.cancel();
  }

  async cancelTurn(sessionId: string, signal?: AbortSignal): Promise<void> {
    const id = managedAgentIdSchema.parse(sessionId);
    const response = await this.request(
      `/${encodeURIComponent(id)}/events`,
      "POST",
      {
        events: [{ type: "agent.session.input.cancel" }],
      },
      signal,
    );

    await response.body?.cancel();
  }

  async streamEvents(sessionId: string, signal?: AbortSignal): Promise<Response> {
    const id = managedAgentIdSchema.parse(sessionId);
    const response = await this.request(
      `/${encodeURIComponent(id)}/events?stream=true`,
      "GET",
      undefined,
      signal,
      true,
    );

    if (!response.body || !response.headers.get("content-type")?.includes("text/event-stream")) {
      await response.body?.cancel();
      throw new AssistantError(
        "Bedrock Managed Agents did not return an event stream",
        ErrorType.EXTERNAL_API_ERROR,
        502,
      );
    }

    return response;
  }

  async listItems(
    sessionId: string,
    query: Partial<ManagedAgentPageQuery> = {},
    signal?: AbortSignal,
  ): Promise<ManagedAgentItems> {
    const id = managedAgentIdSchema.parse(sessionId);
    const page = managedAgentPageQuerySchema.parse(query);

    return readValidatedProviderResponse(
      await this.request(
        `/${encodeURIComponent(id)}/items${toQueryString(page)}`,
        "GET",
        undefined,
        signal,
      ),
      managedAgentItemsSchema,
      8 * 1024 * 1024,
      "Bedrock Managed Agents",
    );
  }

  async deleteSession(sessionId: string, signal?: AbortSignal): Promise<void> {
    const id = managedAgentIdSchema.parse(sessionId);

    try {
      const response = await this.request(
        `/${encodeURIComponent(id)}`,
        "DELETE",
        undefined,
        signal,
      );

      await response.body?.cancel();
    } catch (error) {
      if (!(error instanceof AssistantError) || error.statusCode !== 404) {
        throw error;
      }
    }
  }
}
