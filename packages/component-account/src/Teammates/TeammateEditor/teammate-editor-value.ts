import type { TeammateResponse, ModelConfig } from "@ngriffin_uk/polychat-schemas";
import {
  DEFAULT_TEAMMATE_KIND,
  filterToolIdsForTeammateKind,
  normaliseToolIds,
} from "@ngriffin_uk/polychat-schemas";
import {
  generateId,
  getFiniteNumberOrFallback,
  getNumberInputValue,
} from "@ngriffin_uk/polychat-utility-core";

import type { TeammateFormData } from "../types";
import type { TeammateEditorValue } from "./types";

export const DEFAULT_TEAMMATE_MAX_STEPS = 20;

function isModelSelectable(model: string, models: ModelConfig): boolean {
  return model === "" || Object.keys(models).length === 0 || !!models[model]?.supportsToolCalls;
}

export function createTeammateEditorValue(
  agent: TeammateResponse | null,
  models: ModelConfig,
): TeammateEditorValue {
  if (!agent) {
    return {
      name: "",
      kind: DEFAULT_TEAMMATE_KIND,
      description: "",
      avatarUrl: "",
      systemPrompt: "",
      examples: [],
      mode: null,
      model: "",
      temperature: "",
      maxSteps: DEFAULT_TEAMMATE_MAX_STEPS,
      toolIds: [],
      skillIds: [],
      servers: [],
    };
  }

  const model = agent.model ?? "";
  const maxSteps = getFiniteNumberOrFallback(agent.max_steps, DEFAULT_TEAMMATE_MAX_STEPS);

  return {
    name: agent.name,
    kind: agent.kind,
    description: agent.description,
    avatarUrl: agent.avatar_url ?? "",
    systemPrompt: agent.system_prompt ?? "",
    examples: (agent.few_shot_examples ?? []).map((example) => ({
      id: generateId(),
      input: example.input,
      output: example.output,
    })),
    mode: agent.mode,
    model: isModelSelectable(model, models) ? model : "",
    temperature: getNumberInputValue(agent.temperature),
    maxSteps: maxSteps > 0 ? maxSteps : DEFAULT_TEAMMATE_MAX_STEPS,
    toolIds: agent.enabled_tools ?? [],
    skillIds: agent.skill_ids,
    servers: agent.servers.map((server) => ({
      id: generateId(),
      url: server.url,
      type: server.type ?? "sse",
    })),
  };
}

export function toTeammateFormData(value: TeammateEditorValue): TeammateFormData {
  return {
    name: value.name.trim(),
    kind: value.kind,
    description: value.description.trim(),
    avatar_url: value.avatarUrl.trim(),
    servers: value.servers.map((server) => ({ url: server.url.trim(), type: server.type })),
    model: value.model,
    temperature: value.temperature === "" ? null : value.temperature,
    max_steps: getFiniteNumberOrFallback(value.maxSteps, DEFAULT_TEAMMATE_MAX_STEPS),
    system_prompt: value.systemPrompt,
    few_shot_examples: value.examples.map(({ input, output }) => ({
      input: input.trim(),
      output: output.trim(),
    })),
    enabled_tools: filterToolIdsForTeammateKind(value.kind, normaliseToolIds(value.toolIds)) ?? [],
    skill_ids: value.skillIds,
    mode: value.mode,
  };
}

export function validateTeammateEditorValue(value: TeammateEditorValue): string | null {
  if (!value.name.trim()) {
    return "Give the agent a name.";
  }

  if (value.servers.some((server) => !server.url.trim())) {
    return "Every connection needs a server URL, or remove the empty ones.";
  }

  if (value.examples.some((example) => !example.input.trim() || !example.output.trim())) {
    return "Every example needs both a prompt and a reply, or remove the empty ones.";
  }

  return null;
}
