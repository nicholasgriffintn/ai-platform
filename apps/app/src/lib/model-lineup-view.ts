import {
  getModelDisplayName,
  resolveLineupCandidate,
  type ModelConfigItem,
  type ModelLineupCandidate,
  type ReasoningEffort,
} from "@ngriffin_uk/polychat-schemas";

export interface LineupEntryView {
  id: string;
  name: string;
  provider: string;
  model: ModelConfigItem | null;
  effort?: ReasoningEffort;
  candidateIndex: number;
}

const WEB_LLM_SUFFIX = /-(q\d+f\d+(_\d+)?)-MLC(-\d+k)?$/u;

export function formatWebLlmModelName(id: string): string {
  return id.replace(WEB_LLM_SUFFIX, "").replace(/-/gu, " ");
}

function describeCandidate(candidate: ModelLineupCandidate): LineupEntryView {
  return {
    id: candidate.model,
    name:
      candidate.provider === "web-llm"
        ? formatWebLlmModelName(candidate.model)
        : (candidate.model.split("/").pop() ?? candidate.model),
    provider: candidate.provider,
    model: null,
    effort: candidate.effort,
    candidateIndex: 0,
  };
}

export function resolveLineupHeadline(
  models: Record<string, ModelConfigItem>,
  candidates: readonly ModelLineupCandidate[],
  isEligible?: (model: ModelConfigItem) => boolean,
): LineupEntryView | null {
  if (candidates.length === 0) {
    return null;
  }

  const resolved = resolveLineupCandidate(models, candidates, isEligible ? { isEligible } : {});

  if (!resolved) {
    return isEligible ? null : describeCandidate(candidates[0]);
  }

  return {
    id: resolved.id,
    name: getModelDisplayName(resolved.config),
    provider: resolved.config.provider,
    model: resolved.config,
    effort: resolved.effort,
    candidateIndex: candidates.indexOf(resolved.candidate),
  };
}

export function toModelRecordById(models: ModelConfigItem[]): Record<string, ModelConfigItem> {
  return Object.fromEntries(models.map((model) => [model.id ?? model.matchingModel, model]));
}
