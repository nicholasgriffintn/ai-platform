import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { authorise } from "@ngriffin_uk/polychat-library-policy";
import type { ToolEffectClass } from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";

import { createMetrics } from "~/infrastructure/telemetry";
import { resolveRequestProjectId } from "~/modules/functions/application/request-context";
import type { IRequest } from "~/types";

const logger = getLogger({ prefix: "services/chat/tools/data-flow" });

const PRIVATE_STORE_TOOL_NAMES = new Set([
  "memory",
  "search_conversations",
  "search_documents",
  "get_document",
  "get_note",
  "list_saved_messages",
]);

const EGRESS_EFFECT_CLASSES = new Set<ToolEffectClass>([
  "write",
  "external_send",
  "data_export",
  "destructive",
  "spend",
]);

export interface DataFlowAudit {
  toolName: string;
  destination: string;
  effectClass: ToolEffectClass;
  sourceScope: "personal" | "project";
  memoryInContext: boolean;
  privateReads: string[];
  allowed: boolean;
}

function readPrivateStoreReads(messages: unknown): string[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return [
    ...new Set(
      messages.flatMap((message) =>
        isRecord(message) &&
        message.role === "tool" &&
        typeof message.name === "string" &&
        PRIVATE_STORE_TOOL_NAMES.has(message.name)
          ? [message.name]
          : [],
      ),
    ),
  ].sort();
}

export function evaluateToolDataFlow(params: {
  req: IRequest;
  toolName: string;
  effectClass: ToolEffectClass;
  destination: string | undefined;
}): DataFlowAudit | null {
  if (!params.destination || !EGRESS_EFFECT_CLASSES.has(params.effectClass)) {
    return null;
  }

  const projectId = resolveRequestProjectId(params.req);
  const sourceScope = projectId ? "project" : "personal";
  const sourceId = projectId ?? String(params.req.user?.id ?? "");
  const decision = authorise("data.flow", {
    sourceScope,
    sourceId,
    destinationScope: "external",
    destinationId: params.destination,
  });

  return {
    toolName: params.toolName,
    destination: params.destination,
    effectClass: params.effectClass,
    sourceScope,
    memoryInContext: Boolean(params.req.memoryScope),
    privateReads: readPrivateStoreReads(params.req.request?.messages),
    allowed: decision.allowed,
  };
}

export function recordToolDataFlow(req: IRequest, audit: DataFlowAudit | null): void {
  if (!audit || audit.allowed) {
    return;
  }

  logger.info("Tool call sends conversation data outside its audience", {
    toolName: audit.toolName,
    destination: audit.destination,
    effectClass: audit.effectClass,
    sourceScope: audit.sourceScope,
    memoryInContext: audit.memoryInContext,
    privateReads: audit.privateReads,
  });

  try {
    createMetrics(req.env).recordMetric({
      traceId: String(req.request?.run_id ?? req.request?.completion_id ?? ""),
      type: "performance",
      name: "data_flow_egress",
      value: 1,
      metadata: {
        toolName: audit.toolName,
        destination: audit.destination,
        effectClass: audit.effectClass,
        sourceScope: audit.sourceScope,
        memoryInContext: audit.memoryInContext,
        privateReads: audit.privateReads.join(","),
        mode: "audit",
      },
      status: "info",
    });
  } catch {
    return;
  }
}
