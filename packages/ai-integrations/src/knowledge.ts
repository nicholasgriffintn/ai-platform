import type {
  KnowledgeConnectorDescriptor,
  KnowledgeDocumentMapping,
  KnowledgeSyncMappedResource,
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
  const values = mapping.content.path ? readPathValues(result, mapping.content.path) : [result];

  if (values.length === 0) {
    throw new AssistantError(
      "Knowledge response is missing the configured content field",
      ErrorType.PROVIDER_ERROR,
      502,
    );
  }

  const parts: string[] = [];

  for (const value of values) {
    if (mapping.content.format === "json") {
      parts.push(contentSchema.parse(JSON.stringify(value ?? null)));
      continue;
    }

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
  resource: KnowledgeSyncMappedResource,
): ConnectorKnowledgeDocument {
  const mapping = resource.documentMapping;
  const resourceId = mapping.id ? readDocumentField(result, mapping.id) : resource.resourceId;
  const id = resourceIdSchema.parse(resourceId);

  if (id !== resource.resourceId) {
    throw new AssistantError(
      "Connector returned a different resource",
      ErrorType.PROVIDER_ERROR,
      502,
    );
  }

  const status = readDocumentStatus(result, mapping);
  const title = mapping.title ? readDocumentField(result, mapping.title) : resource.title;
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

type DescriptorContent = NonNullable<KnowledgeConnectorDescriptor["item"]["content"]>;

export interface ConnectorKnowledgeItem {
  externalId: string;
  title: string | null;
  content: string | null;
  status: "available" | "archived";
  externalUri: string | null;
  revision: string | number | null;
  updatedAt: string | null;
}

export type ConnectorKnowledgeNextPage = { cursor: string } | { page: number } | null;

export interface ConnectorKnowledgePage {
  items: ConnectorKnowledgeItem[];
  next: ConnectorKnowledgeNextPage;
}

const PLACEHOLDER_PATTERN = /^\{\{([a-z][a-z0-9_]*)\}\}$/;

export function buildDescriptorParameters(
  template: Record<string, unknown>,
  values: Record<string, string>,
): Record<string, unknown> {
  const parameters: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(template)) {
    const placeholder = typeof value === "string" ? PLACEHOLDER_PATTERN.exec(value) : null;

    if (!placeholder) {
      parameters[key] = value;
      continue;
    }

    const supplied = values[placeholder[1] ?? ""]?.trim();

    if (supplied) {
      parameters[key] = supplied;
    }
  }

  return parameters;
}

function readScalar(value: unknown, path: readonly (string | number)[] | undefined): unknown {
  if (!path) {
    return undefined;
  }

  const values = readPathValues(value, path);

  return values.length === 1 ? values[0] : undefined;
}

function readText(value: unknown, path: readonly (string | number)[] | undefined): string | null {
  if (!path) {
    return null;
  }

  const text = readPathValues(value, path)
    .filter(
      (entry): entry is string | number => typeof entry === "string" || typeof entry === "number",
    )
    .map(String)
    .join("")
    .trim();

  return text || null;
}

function formatContent(values: unknown[], format: DescriptorContent["format"]): string | null {
  const parts = values.flatMap((value) => {
    if (format === "json") {
      return [JSON.stringify(value ?? null)];
    }

    if (typeof value !== "string" || !value.trim()) {
      return [];
    }

    return [format === "html" ? htmlToPlainText(value) : value];
  });
  const content = parts.join("\n").trim();

  return content ? contentSchema.parse(content) : null;
}

function readNextPage(
  result: unknown,
  descriptor: KnowledgeConnectorDescriptor,
  itemCount: number,
  page: number | null,
): ConnectorKnowledgeNextPage {
  const pagination = descriptor.list.pagination;

  if (!pagination || itemCount === 0) {
    return null;
  }

  if (pagination.kind === "page") {
    return { page: (page ?? pagination.start) + 1 };
  }

  if (pagination.hasMore && readScalar(result, pagination.hasMore) !== true) {
    return null;
  }

  const cursor = readScalar(result, pagination.response);

  return typeof cursor === "string" && cursor ? { cursor } : null;
}

export function readConnectorKnowledgePage(
  result: unknown,
  descriptor: KnowledgeConnectorDescriptor,
  page: number | null,
): ConnectorKnowledgePage {
  const entries = readPathValues(result, descriptor.list.items).flatMap((value) =>
    Array.isArray(value) ? value : [value],
  );
  const mapping = descriptor.item;
  const items = entries.flatMap((entry): ConnectorKnowledgeItem[] => {
    const id = resourceIdSchema.safeParse(readScalar(entry, mapping.id));

    if (!id.success) {
      return [];
    }

    const archivedValue = mapping.archived ? readScalar(entry, mapping.archived.path) : undefined;
    const revision = revisionSchema.safeParse(readScalar(entry, mapping.revision));
    const updatedAt = readScalar(entry, mapping.updatedAt);

    return [
      {
        externalId: id.data,
        title: readText(entry, mapping.title)?.slice(0, 200) ?? null,
        content: mapping.content
          ? formatContent(
              mapping.content.path ? readPathValues(entry, mapping.content.path) : [entry],
              mapping.content.format,
            )
          : null,
        status: mapping.archived?.values.some((value) => value === archivedValue)
          ? "archived"
          : "available",
        externalUri: resolveHttpUrl(readScalar(entry, mapping.url)),
        revision: revision.success ? revision.data : null,
        updatedAt:
          typeof updatedAt === "string" || typeof updatedAt === "number" ? String(updatedAt) : null,
      },
    ];
  });

  return { items, next: readNextPage(result, descriptor, entries.length, page) };
}

export function readConnectorKnowledgeBody(
  result: unknown,
  content: DescriptorContent,
): { text: string | null } | { url: string } {
  const values = content.path ? readPathValues(result, content.path) : [result];

  if (content.format === "url") {
    const url = resolveHttpUrl(values[0]);

    if (!url) {
      throw new AssistantError(
        "The connector did not return a download link",
        ErrorType.PROVIDER_ERROR,
        502,
      );
    }

    return { url };
  }

  return { text: formatContent(values, content.format) };
}
