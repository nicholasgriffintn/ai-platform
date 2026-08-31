import {
  defineTool,
  finishToolDefinition,
  updatePlanToolDefinition,
  type ToolDefinition,
} from "@ngriffin_uk/polychat-library-tool-runtime";

export const LEAN_READ_FILE_TOOL = "read_lean_file";
export const LEAN_SEARCH_TOOL = "search_lean_targets";
export const LEAN_REPLACE_TOOL = "replace_lean_text";
export const LEAN_CHECK_TOOL = "check_lean_targets";
export const LEAN_LSP_DIAGNOSTICS_TOOL = "lean_lsp_diagnostics";

const readFileTool = defineTool({
  name: LEAN_READ_FILE_TOOL,
  description: "Read a bounded line range from one of the requested Lean target files.",
  parameters: {
    path: { type: "string", description: "A requested repository-relative .lean target path." },
    startLine: { type: "number", description: "First line, 1-indexed. Defaults to 1." },
    endLine: { type: "number", description: "Last line, inclusive. At most 240 lines." },
  },
  required: ["path"],
});

const searchTool = defineTool({
  name: LEAN_SEARCH_TOOL,
  description: "Search for a fixed text string within the requested Lean target files.",
  parameters: {
    query: {
      type: "string",
      description: "Literal text to find. Regular expressions are not used.",
    },
  },
  required: ["query"],
});

const replaceTool = defineTool({
  name: LEAN_REPLACE_TOOL,
  description:
    "Replace one exact, uniquely occurring text block in a requested Lean target. The replacement is rejected unless the old text occurs exactly once.",
  parameters: {
    path: { type: "string", description: "A requested repository-relative .lean target path." },
    oldText: { type: "string", description: "Exact existing text, including whitespace." },
    newText: { type: "string", description: "Replacement Lean source." },
  },
  required: ["path", "oldText", "newText"],
});

const checkTool = defineTool({
  name: LEAN_CHECK_TOOL,
  description:
    "Run the fixed Lean compiler checks over every requested target and report diagnostics. No arbitrary command is accepted.",
  parameters: {},
});

const lspDiagnosticsTool = defineTool({
  name: LEAN_LSP_DIAGNOSTICS_TOOL,
  description:
    "Request read-only advisory diagnostics from Lean LSP MCP for one requested target. Use this to inspect errors, but use check_lean_targets as the final correctness authority.",
  parameters: {
    path: { type: "string", description: "A requested repository-relative .lean target path." },
  },
  required: ["path"],
});

export const LEAN_PROOF_TOOLS: ToolDefinition[] = [
  readFileTool,
  searchTool,
  replaceTool,
  lspDiagnosticsTool,
  checkTool,
  updatePlanToolDefinition,
  finishToolDefinition,
];

function requiredString(args: Record<string, unknown>, name: string, maxLength: number): string {
  const value = args[name];

  if (typeof value !== "string" || !value || value.length > maxLength) {
    throw new Error(`${name} must be a non-empty string no longer than ${maxLength} characters`);
  }

  return value;
}

export function parseLeanReadArgs(args: Record<string, unknown>) {
  const startLine =
    typeof args.startLine === "number" && Number.isFinite(args.startLine)
      ? Math.max(1, Math.floor(args.startLine))
      : 1;
  const requestedEnd =
    typeof args.endLine === "number" && Number.isFinite(args.endLine)
      ? Math.max(startLine, Math.floor(args.endLine))
      : startLine + 239;

  return {
    path: requiredString(args, "path", 512),
    startLine,
    endLine: Math.min(requestedEnd, startLine + 239),
  };
}

export function parseLeanSearchArgs(args: Record<string, unknown>) {
  return { query: requiredString(args, "query", 500) };
}

export function parseLeanReplaceArgs(args: Record<string, unknown>) {
  return {
    path: requiredString(args, "path", 512),
    oldText: requiredString(args, "oldText", 20_000),
    newText: requiredString(args, "newText", 40_000),
  };
}

export function parseLeanLspArgs(args: Record<string, unknown>) {
  return { path: requiredString(args, "path", 512) };
}
