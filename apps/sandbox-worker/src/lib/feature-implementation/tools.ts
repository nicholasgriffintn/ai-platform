import {
  finishToolDefinition,
  updatePlanToolDefinition,
  type AgentToolDefinition,
} from "@ngriffin_uk/polychat-library-agent-core";

import { MAX_PARALLEL_COMMANDS, MAX_READ_FILES_BATCH } from "./constants";

export const RUN_COMMAND_TOOL_NAME = "run_command";
export const READ_FILES_TOOL_NAME = "read_files";
export const RUN_SCRIPT_TOOL_NAME = "run_script";

export type ScriptLanguage = "python" | "javascript" | "typescript";

export interface ReadFileTarget {
  path: string;
  startLine?: number;
  endLine?: number;
}

export interface ReadFilesAction {
  files: ReadFileTarget[];
}

export interface RunCommandAction {
  commands: string[];
}

export interface RunScriptAction {
  code: string;
  language: ScriptLanguage;
}

const runCommandToolDefinition: AgentToolDefinition = {
  type: "function",
  function: {
    name: RUN_COMMAND_TOOL_NAME,
    description:
      "Run one or more shell commands in the repository. Pass several commands only when they are independent and safe to run together.",
    parameters: {
      type: "object",
      properties: {
        commands: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: MAX_PARALLEL_COMMANDS,
          description: "Shell commands to run, in order.",
        },
      },
      required: ["commands"],
    },
  },
};

const readFilesToolDefinition: AgentToolDefinition = {
  type: "function",
  function: {
    name: READ_FILES_TOOL_NAME,
    description:
      "Read one or more files from the repository, optionally limited to a line range. Prefer reading several related files in one call.",
    parameters: {
      type: "object",
      properties: {
        files: {
          type: "array",
          minItems: 1,
          maxItems: MAX_READ_FILES_BATCH,
          items: {
            type: "object",
            properties: {
              path: { type: "string", description: "Repository-relative file path." },
              startLine: { type: "number", description: "First line to read, 1-indexed." },
              endLine: { type: "number", description: "Last line to read, inclusive." },
            },
            required: ["path"],
          },
        },
      },
      required: ["files"],
    },
  },
};

const runScriptToolDefinition: AgentToolDefinition = {
  type: "function",
  function: {
    name: RUN_SCRIPT_TOOL_NAME,
    description:
      "Run a short script in the repository when a shell command would be awkward. Use for multi-step file edits or data processing.",
    parameters: {
      type: "object",
      properties: {
        code: { type: "string", description: "The script source to run." },
        language: {
          type: "string",
          enum: ["python", "javascript", "typescript"],
          description: "Script language. Defaults to javascript.",
        },
      },
      required: ["code"],
    },
  },
};

export function getSandboxAgentTools(options: {
  readOnlyCommands: boolean;
}): AgentToolDefinition[] {
  const tools: AgentToolDefinition[] = [
    runCommandToolDefinition,
    readFilesToolDefinition,
    updatePlanToolDefinition,
    finishToolDefinition,
  ];

  if (!options.readOnlyCommands) {
    tools.splice(2, 0, runScriptToolDefinition);
  }

  return tools;
}

function readStringArray(value: unknown): string[] {
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function readOptionalLine(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : undefined;
}

export function parseRunCommandAction(args: Record<string, unknown>): RunCommandAction {
  const commands = readStringArray(args.commands ?? args.command);

  if (commands.length === 0) {
    throw new Error(`${RUN_COMMAND_TOOL_NAME} requires at least one command`);
  }

  return { commands: commands.slice(0, MAX_PARALLEL_COMMANDS) };
}

export function parseReadFilesAction(args: Record<string, unknown>): ReadFilesAction {
  const rawFiles = Array.isArray(args.files)
    ? args.files
    : typeof args.path === "string"
      ? [{ path: args.path, startLine: args.startLine, endLine: args.endLine }]
      : [];

  const files = rawFiles.flatMap((entry): ReadFileTarget[] => {
    if (typeof entry === "string" && entry.trim()) {
      return [{ path: entry.trim() }];
    }

    if (!entry || typeof entry !== "object") {
      return [];
    }

    const record = entry as Record<string, unknown>;

    if (typeof record.path !== "string" || !record.path.trim()) {
      return [];
    }

    return [
      {
        path: record.path.trim(),
        startLine: readOptionalLine(record.startLine),
        endLine: readOptionalLine(record.endLine),
      },
    ];
  });

  if (files.length === 0) {
    throw new Error(`${READ_FILES_TOOL_NAME} requires at least one file path`);
  }

  return { files: files.slice(0, MAX_READ_FILES_BATCH) };
}

export function parseRunScriptAction(args: Record<string, unknown>): RunScriptAction {
  const code = typeof args.code === "string" ? args.code : "";

  if (!code.trim()) {
    throw new Error(`${RUN_SCRIPT_TOOL_NAME} requires code to run`);
  }

  const rawLanguage = typeof args.language === "string" ? args.language.toLowerCase().trim() : "";
  const language: ScriptLanguage =
    rawLanguage === "python" || rawLanguage === "typescript" || rawLanguage === "javascript"
      ? rawLanguage
      : "javascript";

  return { code, language };
}

export interface ReadFileDecision extends ReadFileTarget {
  reasoning?: string;
}

export interface ReadFilesDecision extends ReadFilesAction {
  reasoning?: string;
}

export interface RunCommandDecision {
  command: string;
  reasoning?: string;
}

export interface RunParallelDecision {
  commands: string[];
  reasoning?: string;
}

export interface RunScriptDecision {
  code: string;
  language?: ScriptLanguage;
  reasoning?: string;
}
