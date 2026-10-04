import type {
  KnowledgeDocumentMapping,
  KnowledgeSyncResource,
} from "@ngriffin_uk/polychat-schemas";
import { readPathValues, resolveHttpUrl } from "@ngriffin_uk/polychat-utility-core";
import { base64ToBuffer } from "@ngriffin_uk/polychat-utility-server/base64";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { htmlToPlainText } from "@ngriffin_uk/polychat-utility-server/html-text";
import z from "zod/v4";

export interface ConnectorKnowledgeDocument {
  title: string;
  content: string;
  status: "available" | "archived";
  externalUri: string | null;
  upstreamRevision: string | number | null;
}

const resourceIdSchema = z.union([z.string().min(1), z.number().finite()]).transform(String);
const titleSchema = z.string().min(1).max(200);
const contentSchema = z.string().max(500_000);
const revisionSchema = z.union([z.string().min(1).max(200), z.number().int().positive()]);

function readDocumentField(
  result: unknown,
  path: readonly (string | number)[] | undefined,
): unknown {
  if (!path) {
    return undefined;
  }

  const values = readPathValues(result, path);

  return values.length === 1 ? values[0] : undefined;
}

function readDocumentStatus(
  result: unknown,
  mapping: KnowledgeDocumentMapping,
): "available" | "archived" {
  if (!mapping.state) {
    return "available";
  }

  const state = readDocumentField(result, mapping.state.path);

  for (const value of mapping.state.archivedValues) {
    if (value === state) {
      return "archived";
    }
  }

  if (mapping.state.availableValues) {
    for (const value of mapping.state.availableValues) {
      if (value === state) {
        return "available";
      }
    }
  } else if (state !== undefined) {
    return "available";
  }

  throw new AssistantError(
    "Knowledge resource state is not available",
    ErrorType.PROVIDER_ERROR,
    502,
  );
}

function readDocumentContent(result: unknown, mapping: KnowledgeDocumentMapping): string {
  const values = readPathValues(result, mapping.content.path);

  if (values.length === 0) {
    throw new AssistantError(
      "Knowledge response is missing the configured content field",
      ErrorType.PROVIDER_ERROR,
      502,
    );
  }

  const parts: string[] = [];

  for (const value of values) {
    const content = contentSchema.parse(value);

    switch (mapping.content.format) {
      case "html":
        parts.push(htmlToPlainText(content));
        break;
      case "base64": {
        const buffer = base64ToBuffer(content);
        const decoded = new TextDecoder("utf-8", { fatal: true }).decode(buffer);

        parts.push(decoded);
        break;
      }

      default:
        parts.push(content);
    }
  }

  const content = parts.join("\n");

  return contentSchema.parse(content);
}

export function normaliseConnectorKnowledge(
  result: unknown,
  resource: KnowledgeSyncResource,
): ConnectorKnowledgeDocument {
  const mapping = resource.documentMapping;
  const resourceId = readDocumentField(result, mapping.id);
  const id = resourceIdSchema.parse(resourceId);

  if (id !== resource.resourceId) {
    throw new AssistantError(
      "Connector returned a different resource",
      ErrorType.PROVIDER_ERROR,
      502,
    );
  }

  const status = readDocumentStatus(result, mapping);
  const title = readDocumentField(result, mapping.title);
  const revision = readDocumentField(result, mapping.revision);
  const url = readDocumentField(result, mapping.url);
  const urlBase = readDocumentField(result, mapping.urlBase);

  return {
    title: titleSchema.parse(status === "archived" && title === undefined ? id : title),
    status,
    content: status === "archived" ? "" : readDocumentContent(result, mapping),
    externalUri: resolveHttpUrl(url, urlBase),
    upstreamRevision:
      revision === undefined || revision === null ? null : revisionSchema.parse(revision),
  };
}
