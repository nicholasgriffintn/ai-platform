import { describe, expect, it } from "vitest";

import { contentExtractSchema, recipeInstallationUpdateRequestSchema } from "./apps";
import { buildAssistantActionCatalog, type AssistantActionAgentSource } from "./assistant-actions";
import {
  deleteEmbeddingSchema,
  insertEmbeddingSchema,
  queryEmbeddingsSchema,
  RESERVED_EMBEDDING_METADATA_KEYS,
} from "./embeddings";
import { ocrSchema } from "./ocr";
import { updateUserSettingsSchema } from "./user/userSettings";

describe("embedding request schemas", () => {
  it("rejects client-controlled embedding authority", () => {
    expect(
      insertEmbeddingSchema.safeParse({
        type: "note",
        content: "private note",
        rag_options: { namespace: "another-user" },
      }).success,
    ).toBe(false);
    expect(
      queryEmbeddingsSchema.safeParse({
        query: "private note",
        namespace: "another-user",
      }).success,
    ).toBe(false);
  });

  it("enforces embedding text and identifier limits", () => {
    const base = { type: "note", content: "Private note" };

    expect(insertEmbeddingSchema.safeParse({ ...base, title: "t".repeat(201) }).success).toBe(
      false,
    );
    expect(insertEmbeddingSchema.safeParse({ ...base, id: "unsafe/id" }).success).toBe(false);
    expect(insertEmbeddingSchema.safeParse({ ...base, type: "unsafe type" }).success).toBe(false);
    expect(insertEmbeddingSchema.safeParse({ ...base, content: "😀".repeat(65_537) }).success).toBe(
      false,
    );
    expect(queryEmbeddingsSchema.safeParse({ query: "q".repeat(1001) }).success).toBe(false);
    expect(queryEmbeddingsSchema.safeParse({ query: "   " }).success).toBe(false);
  });

  it("bounds metadata and rejects lifecycle authority", () => {
    const base = { type: "note", content: "Private note" };
    const tooDeep = { first: { second: { third: { fourth: "too deep" } } } };

    expect(
      insertEmbeddingSchema.safeParse({ ...base, metadata: { namespace: "user_kb_999" } }).success,
    ).toBe(false);
    expect(insertEmbeddingSchema.safeParse({ ...base, metadata: tooDeep }).success).toBe(false);
    expect(
      insertEmbeddingSchema.safeParse({ ...base, metadata: { note: "x".repeat(8 * 1024) } })
        .success,
    ).toBe(false);
  });

  it.each(RESERVED_EMBEDDING_METADATA_KEYS)("rejects reserved metadata key %s", (key) => {
    expect(
      insertEmbeddingSchema.safeParse({
        type: "note",
        content: "Private note",
        metadata: { [key]: "client-controlled" },
      }).success,
    ).toBe(false);
  });

  it("requires a bounded unique deletion set", () => {
    expect(deleteEmbeddingSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(deleteEmbeddingSchema.safeParse({ ids: ["note-1", "note-1"] }).success).toBe(false);
    expect(
      deleteEmbeddingSchema.safeParse({
        ids: Array.from({ length: 101 }, (_, index) => `note-${index}`),
      }).success,
    ).toBe(false);
  });
});

describe("recipe installation update schema", () => {
  it("does not turn an omitted configuration into an empty update", () => {
    expect(recipeInstallationUpdateRequestSchema.parse({ status: "paused" })).toEqual({
      status: "paused",
    });
  });
});
describe("OCR schema", () => {
  it("accepts private inputs and the OCR 4 feature set", () => {
    expect(
      ocrSchema.parse({
        document: { type: "source", source_id: "source-1" },
        pages: "0-2,4",
        include_blocks: true,
        confidence_scores_granularity: "word",
        table_format: "html",
        extract_header: true,
        extract_footer: true,
        document_annotation_format: {
          type: "json_schema",
          json_schema: {
            name: "invoice",
            schema: { type: "object", properties: { total: { type: "number" } } },
          },
        },
        document_annotation_prompt: "Extract the invoice total",
      }),
    ).toMatchObject({
      document: { type: "source", source_id: "source-1" },
      pages: "0-2,4",
      table_format: "html",
    });
  });

  it("accepts explicit public image and document inputs", () => {
    expect(
      ocrSchema.parse({
        document: { type: "image_url", image_url: "https://example.com/scan.png" },
      }).document.type,
    ).toBe("image_url");
    expect(
      ocrSchema.parse({
        document: { type: "document_url", document_url: "https://example.com/scan.pdf" },
      }).document.type,
    ).toBe("document_url");
  });

  it("only accepts supported base64 image data URLs", () => {
    expect(
      ocrSchema.safeParse({
        document: { type: "image_url", image_url: "data:image/png;base64,iVBORw0KGgo=" },
      }).success,
    ).toBe(true);
    expect(
      ocrSchema.safeParse({
        document: { type: "image_url", image_url: "data:image/svg+xml;base64,PHN2Zz4=" },
      }).success,
    ).toBe(false);
    expect(
      ocrSchema.safeParse({
        document: { type: "image_url", image_url: "data:image/png,not-base64" },
      }).success,
    ).toBe(false);
  });

  it("rejects ambiguous inputs and annotation prompts without a format", () => {
    expect(
      ocrSchema.safeParse({
        document: {
          type: "source",
          source_id: "source-1",
          output_id: "output-1",
        },
      }).success,
    ).toBe(false);
    expect(
      ocrSchema.safeParse({
        document: { type: "output", output_id: "output-1" },
        document_annotation_prompt: "Extract fields",
      }).success,
    ).toBe(false);
  });

  it("rejects invalid page ranges and oversized annotation prompts", () => {
    expect(
      ocrSchema.safeParse({
        document: { type: "source", source_id: "source-1" },
        pages: "2-last",
      }).success,
    ).toBe(false);
    expect(
      ocrSchema.safeParse({
        document: { type: "source", source_id: "source-1" },
        document_annotation_format: {
          type: "json_schema",
          json_schema: { name: "document", schema: { type: "object" } },
        },
        document_annotation_prompt: "x".repeat(16_385),
      }).success,
    ).toBe(false);
  });
});

describe("embedding provider configuration schemas", () => {
  it("accepts only supported lifecycle providers and valid S3 targets", () => {
    expect(
      updateUserSettingsSchema.safeParse({
        embedding_provider: "s3vectors",
        s3vectors_bucket_name: "private-vectors",
        s3vectors_index_name: "notes.v1",
        s3vectors_region: "eu-west-2",
      }).success,
    ).toBe(true);
    expect(updateUserSettingsSchema.safeParse({ embedding_provider: "mistral" }).success).toBe(
      false,
    );
    expect(updateUserSettingsSchema.safeParse({ embedding_provider: "bedrock" }).success).toBe(
      false,
    );
    expect(
      updateUserSettingsSchema.safeParse({ s3vectors_bucket_name: "INVALID_BUCKET" }).success,
    ).toBe(false);
    expect(
      updateUserSettingsSchema.safeParse({ s3vectors_index_name: "../other-index" }).success,
    ).toBe(false);
    expect(updateUserSettingsSchema.safeParse({ s3vectors_region: "localhost" }).success).toBe(
      false,
    );
    expect(updateUserSettingsSchema.safeParse({ embedding_provider: "s3vectors" }).success).toBe(
      false,
    );
  });

  it("limits content extraction to ten URLs", () => {
    expect(
      contentExtractSchema.safeParse({
        urls: Array.from({ length: 10 }, (_, index) => `https://example.com/${index}`),
      }).success,
    ).toBe(true);
    expect(
      contentExtractSchema.safeParse({
        urls: Array.from({ length: 11 }, (_, index) => `https://example.com/${index}`),
      }).success,
    ).toBe(false);
  });
});

describe("agent capability descriptors", () => {
  const baseAgent: AssistantActionAgentSource = {
    id: "agent-1",
    name: "Researcher",
    description: "Reads long documents.",
    avatarUrl: null,
    model: "claude-sonnet",
    modelAvailable: true,
    mode: "plan",
    ownerScopeType: "user",
    skillIds: [],
    toolIds: [],
    unavailableSkillIds: [],
    unavailableToolIds: [],
  };

  function describeAgent(agent: AssistantActionAgentSource) {
    const [item] = buildAssistantActionCatalog({ agents: [agent] }).items;

    return item;
  }

  it("reports an agent unavailable and says why when its model cannot be run", () => {
    const item = describeAgent({ ...baseAgent, modelAvailable: false });

    expect(item.capability.availability).toBe("unavailable");
    expect(item.capability.availabilityReason).toContain("claude-sonnet");
  });

  it("names the skills and tools this scope cannot give the agent", () => {
    const item = describeAgent({
      ...baseAgent,
      skillIds: ["artifacts"],
      unavailableSkillIds: ["artifacts"],
    });

    expect(item.capability.availability).toBe("unavailable");
    expect(item.capability.availabilityReason).toContain("artifacts");
  });

  it("requires tool calling only from an agent that carries skills or tools", () => {
    expect(describeAgent(baseAgent).capability.requiredModelCapabilities).toEqual([]);
    expect(
      describeAgent({ ...baseAgent, toolIds: ["web_search"] }).capability.requiredModelCapabilities,
    ).toEqual(["supportsToolCalls"]);
  });

  it("separates a workspace agent from a personal one by auth and category", () => {
    const personal = describeAgent(baseAgent);
    const workspace = describeAgent({ ...baseAgent, ownerScopeType: "workspace" });

    expect(personal.capability.authRequirement).toBe("signed_in");
    expect(personal.metadata?.category).toBe("Personal");
    expect(workspace.capability.authRequirement).toBe("pro");
    expect(workspace.capability.authState).toBe("pro_required");
    expect(workspace.metadata?.category).toBe("Workspace");
    expect(workspace.capability.tags).toContain("workspace");
    expect(workspace.capability.tags).toContain("plan");
  });
});
