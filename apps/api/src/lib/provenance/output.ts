import {
  MAX_OUTPUT_PROVENANCE_APPROVALS,
  MAX_OUTPUT_PROVENANCE_SKILLS,
  MAX_OUTPUT_PROVENANCE_SOURCES,
  PROVENANCE_PROTOCOL_VERSION,
  outputProvenanceSchema,
  type OutputProvenance,
  type ChatRun,
  type ProvenanceApproval,
  type ProvenanceModel,
  type ProvenanceRun,
  type ProvenanceSkill,
  type ProvenanceSource,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { requireChatRunAccess } from "~/services/chat-runs/status";
import { safeParseJson } from "~/utils/json";

export function createOutputProvenance(input: {
  origin: OutputProvenance["origin"];
  capturedAt?: string;
  run?: ProvenanceRun | null;
  model?: ProvenanceModel | null;
  skills?: ProvenanceSkill[];
  sources?: ProvenanceSource[];
  approvals?: ProvenanceApproval[];
  completeness?: OutputProvenance["completeness"];
}): OutputProvenance {
  const run = input.run ?? null;
  const model = input.model ?? null;
  const skills = input.skills ?? [];
  const sources = input.sources ?? [];
  const approvals = input.approvals ?? [];
  const truncated =
    skills.length > MAX_OUTPUT_PROVENANCE_SKILLS ||
    sources.length > MAX_OUTPUT_PROVENANCE_SOURCES ||
    approvals.length > MAX_OUTPUT_PROVENANCE_APPROVALS;

  return {
    protocolVersion: PROVENANCE_PROTOCOL_VERSION,
    capturedAt: input.capturedAt ?? new Date().toISOString(),
    completeness: truncated
      ? "partial"
      : (input.completeness ?? (input.origin === "generated" && model ? "complete" : "partial")),
    origin: input.origin,
    run,
    model,
    skills: skills.slice(0, MAX_OUTPUT_PROVENANCE_SKILLS),
    sources: sources.slice(0, MAX_OUTPUT_PROVENANCE_SOURCES),
    approvals: approvals.slice(0, MAX_OUTPUT_PROVENANCE_APPROVALS),
  };
}

export function legacyOutputProvenance(createdAt: string): OutputProvenance {
  return createOutputProvenance({
    origin: "legacy",
    capturedAt: createdAt,
    completeness: "legacy",
  });
}

export function parseOutputProvenance(value: unknown, createdAt: string): OutputProvenance {
  const parsedValue = typeof value === "string" ? safeParseJson(value) : value;
  const parsed = outputProvenanceSchema.safeParse(parsedValue);

  return parsed.success ? parsed.data : legacyOutputProvenance(createdAt);
}

export function addOutputProvenanceSources(
  provenance: OutputProvenance,
  sourceIds: readonly string[],
): OutputProvenance {
  const sources = new Map(provenance.sources.map((source) => [source.id, source]));
  const originalSourceCount = sources.size;

  for (const sourceId of sourceIds) {
    if (!sources.has(sourceId)) {
      sources.set(sourceId, { id: sourceId, name: null, state: "referenced" });
    }
  }

  const allSources = [...sources.values()];

  return {
    ...provenance,
    completeness:
      allSources.length > MAX_OUTPUT_PROVENANCE_SOURCES || allSources.length > originalSourceCount
        ? "partial"
        : provenance.completeness,
    sources: allSources.slice(0, MAX_OUTPUT_PROVENANCE_SOURCES),
  };
}

export function createChatRunProvenance(run: ChatRun): OutputProvenance {
  const snapshot = run.context ?? null;

  return createOutputProvenance({
    origin: "generated",
    capturedAt: run.completedAt ?? run.updatedAt,
    run: { id: run.id, attempt: run.attempt },
    model:
      snapshot?.model && snapshot.provider
        ? { id: snapshot.model, provider: snapshot.provider }
        : null,
    skills:
      snapshot?.skills
        .filter((skill) => skill.state === "loaded")
        .map((skill) =>
          skill.revision === undefined
            ? { id: skill.id, name: skill.name }
            : { id: skill.id, name: skill.name, revision: skill.revision },
        ) ?? [],
    sources:
      snapshot?.sources.map((source) => ({
        id: source.id,
        name: source.name,
        state: source.status === "unavailable" ? ("unavailable" as const) : ("referenced" as const),
      })) ?? [],
    approvals:
      snapshot?.approvals?.map((approval) => ({
        id: approval.id,
        type: approval.type,
        status: approval.status,
        toolName: approval.toolName,
      })) ?? [],
    completeness: snapshot?.model && snapshot.provider ? "complete" : "partial",
  });
}

export async function createExecutionOutputProvenance(
  context: ServiceContext,
  input: {
    runId?: string | null;
    modelId?: string | null;
    provider?: string | null;
    capturedAt?: string;
  },
): Promise<OutputProvenance> {
  const run = input.runId ? await requireChatRunAccess(context, input.runId) : null;
  const snapshot = run?.context ?? null;
  const modelId = input.modelId ?? snapshot?.model ?? null;
  const provider = input.provider ?? snapshot?.provider ?? null;

  if (run && !input.modelId && !input.provider && !input.capturedAt) {
    return createChatRunProvenance(run);
  }

  return createOutputProvenance({
    origin: "generated",
    capturedAt: input.capturedAt,
    run: run ? { id: run.id, attempt: run.attempt } : null,
    model: modelId && provider ? { id: modelId, provider } : null,
    skills:
      snapshot?.skills
        .filter((skill) => skill.state === "loaded")
        .map((skill) =>
          skill.revision === undefined
            ? { id: skill.id, name: skill.name }
            : { id: skill.id, name: skill.name, revision: skill.revision },
        ) ?? [],
    sources:
      snapshot?.sources.map((source) => ({
        id: source.id,
        name: source.name,
        state: "referenced" as const,
      })) ?? [],
    approvals:
      snapshot?.approvals?.map((approval) => ({
        id: approval.id,
        type: approval.type,
        status: approval.status,
        toolName: approval.toolName,
      })) ?? [],
    completeness: modelId && provider && (!input.runId || run) ? "complete" : "partial",
  });
}
