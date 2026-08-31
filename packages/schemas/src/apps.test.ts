import { describe, expect, it } from "vitest";

import { projectExperienceDefinitionSchema, recipeInstallationUpdateRequestSchema } from "./apps";
import { ocrSchema } from "./ocr";

describe("recipe installation update schema", () => {
  it("does not turn an omitted configuration into an empty update", () => {
    expect(recipeInstallationUpdateRequestSchema.parse({ status: "paused" })).toEqual({
      status: "paused",
    });
  });
});
describe("experience scope schema", () => {
  const experience = {
    id: "lean-proofs",
    runtime: "lean-proofs",
    name: "Lean Proofs",
    description: "Develop and verify Lean proofs in a project repository.",
    scopes: ["project"],
    requirement: {
      kind: "capability",
      capabilityKind: "app",
      capabilityId: "featured-lean-proofs",
    },
  };

  it("supports project-only experiences without accepting duplicate scopes", () => {
    expect(projectExperienceDefinitionSchema.safeParse(experience).success).toBe(true);
    expect(
      projectExperienceDefinitionSchema.safeParse({
        ...experience,
        scopes: ["project", "project"],
      }).success,
    ).toBe(false);
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
