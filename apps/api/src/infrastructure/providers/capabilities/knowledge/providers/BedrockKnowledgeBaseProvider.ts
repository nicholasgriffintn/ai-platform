import { bedrockKnowledgeBaseRetrieveResponseSchema } from "@ngriffin_uk/polychat-schemas";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { AwsClient } from "aws4fetch";

import type { KnowledgeBaseHit, KnowledgeBaseProvider } from "../types";

const REGION_PATTERN = /^[a-z]{2}(-[a-z]+)+-\d$/;
const KNOWLEDGE_BASE_ID_PATTERN = /^[0-9A-Za-z]{1,40}$/;

export class BedrockKnowledgeBaseProvider implements KnowledgeBaseProvider {
  readonly id = "bedrock_knowledge_base";

  constructor(
    private readonly credentials: {
      secretAccessKey: string;
      accessKeyId: string;
      knowledgeBaseId: string;
      region: string;
    },
  ) {
    if (
      !REGION_PATTERN.test(credentials.region) ||
      !KNOWLEDGE_BASE_ID_PATTERN.test(credentials.knowledgeBaseId)
    ) {
      throw new AssistantError(
        "Check the knowledge base ID and region saved with this connection",
        ErrorType.CONFIGURATION_ERROR,
        400,
      );
    }
  }

  async search(query: string, limit: number): Promise<KnowledgeBaseHit[]> {
    const { secretAccessKey, accessKeyId, knowledgeBaseId, region } = this.credentials;
    const aws = new AwsClient({ accessKeyId, secretAccessKey, region, service: "bedrock" });
    const response = await aws.fetch(
      `https://bedrock-agent-runtime.${region}.amazonaws.com/knowledgebases/${knowledgeBaseId}/retrieve`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          retrievalQuery: { text: query },
          retrievalConfiguration: { vectorSearchConfiguration: { numberOfResults: limit } },
        }),
      },
    );

    if (!response.ok) {
      await response.body?.cancel();
      throw new AssistantError(
        `Amazon Bedrock answered with ${response.status}`,
        ErrorType.PROVIDER_ERROR,
        response.status === 403 ? 403 : 502,
      );
    }

    const parsed = bedrockKnowledgeBaseRetrieveResponseSchema.safeParse(await response.json());

    if (!parsed.success) {
      throw new AssistantError(
        "Amazon Bedrock returned an unexpected response",
        ErrorType.PROVIDER_ERROR,
        502,
      );
    }

    return Promise.all(
      parsed.data.retrievalResults.flatMap((result) => {
        const text = result.content.text?.trim();

        if (!text) {
          return [];
        }

        const location = result.location;
        const url =
          location?.webLocation?.url ??
          location?.confluenceLocation?.url ??
          location?.salesforceLocation?.url ??
          location?.sharePointLocation?.url ??
          location?.s3Location?.uri ??
          null;

        return [
          sha256Hex(`${url ?? ""}:${text}`).then((digest) => ({
            id: digest.slice(0, 32),
            title: url?.split("/").pop() || "Knowledge base passage",
            content: text,
            url: url?.startsWith("http") ? url : null,
            score: result.score ?? 0,
          })),
        ];
      }),
    );
  }
}
