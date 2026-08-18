import type { PashiField, PashiTool, PashiToolType } from "./contracts";

export interface PashiToolSummary {
  aliases: string[];
  audience: string;
  category: string;
  description: string;
  executable: boolean;
  fields: Array<{
    description?: string;
    id: string;
    options?: string[];
    placeholder?: string;
    required: boolean;
  }>;
  id: string;
  input: {
    kind: "file" | "none" | "text";
    label: string;
    required: boolean;
  };
  label: string;
  outputs: string[];
  resultKind?: string;
  toolType: PashiToolType;
  unavailableReason?: string;
}

export function isPashiToolExecutable(tool: PashiTool): boolean {
  if (tool.toolType === "converter") {
    return tool.status === "available" && tool.input.kind !== "file";
  }

  return true;
}

export function getPashiToolUnavailableReason(tool: PashiTool): string | undefined {
  if (tool.toolType === "converter" && tool.input.kind === "file") {
    return "File converters are not supported by the chat integration yet.";
  }

  if (tool.toolType === "converter" && tool.status !== "available") {
    return "Pashi currently reports this converter as unavailable.";
  }

  return undefined;
}

export function getPashiToolFields(tool: PashiTool): PashiField[] {
  const fields =
    tool.toolType === "converter" ? (tool.api?.fields ?? []) : (tool.input.fields ?? []);

  if (
    tool.toolType === "converter" &&
    tool.outputs?.length &&
    !fields.some((field) => field.id === "outputFormat")
  ) {
    return [
      ...fields,
      {
        id: "outputFormat",
        label: "Output format",
        required: true,
        values: tool.outputs,
      },
    ];
  }

  return fields;
}

export function toPashiToolSummary(tool: PashiTool): PashiToolSummary {
  const unavailableReason = getPashiToolUnavailableReason(tool);
  const fields = getPashiToolFields(tool);

  return {
    aliases: tool.aliases,
    audience: tool.audience,
    category: tool.display.category,
    description: tool.description,
    executable: isPashiToolExecutable(tool),
    fields: fields.map((field) => ({
      id: field.id,
      required: field.required ?? false,
      ...(field.description ? { description: field.description } : {}),
      ...(field.options?.length ? { options: field.options } : {}),
      ...(field.values?.length ? { options: field.values } : {}),
      ...(field.placeholder ? { placeholder: field.placeholder } : {}),
    })),
    id: tool.id,
    input: {
      kind: tool.input.kind ?? tool.input.mode ?? "text",
      label: tool.input.label,
      required: tool.input.required,
    },
    label: tool.label,
    outputs: tool.outputs ?? [],
    resultKind: tool.result?.kind,
    toolType: tool.toolType,
    ...(unavailableReason ? { unavailableReason } : {}),
  };
}

function scorePashiTool(tool: PashiTool, queryTerms: string[]): number {
  if (queryTerms.length === 0) {
    return 1;
  }

  const exactNames = [tool.id, tool.label, ...tool.aliases].map((value) => value.toLowerCase());
  const searchableText = [
    tool.id,
    tool.label,
    tool.description,
    tool.audience,
    tool.display.category,
    ...tool.aliases,
    ...tool.display.examples,
  ]
    .join(" ")
    .toLowerCase();

  return queryTerms.reduce((score, term) => {
    if (exactNames.includes(term)) {
      return score + 30;
    }

    if (exactNames.some((name) => name.includes(term))) {
      return score + 12;
    }

    return searchableText.includes(term) ? score + 4 : score;
  }, 0);
}

export function searchPashiTools(params: {
  limit: number;
  query?: string;
  toolTypes: PashiToolType[];
  tools: PashiTool[];
}): PashiToolSummary[] {
  const queryTerms = (params.query ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  const toolTypes = new Set(params.toolTypes);

  return params.tools
    .filter((tool) => toolTypes.has(tool.toolType))
    .map((tool, index) => ({
      index,
      score: scorePashiTool(tool, queryTerms),
      tool,
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, params.limit)
    .map(({ tool }) => toPashiToolSummary(tool));
}
