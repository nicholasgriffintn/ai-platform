import { WORKSPACE_ROOT } from "@ngriffin_uk/polychat-library-sandbox";
import { quoteShellArgument, truncateText } from "@ngriffin_uk/polychat-utility-core";
import z from "zod/v4";

import type { HarnessToolEffect } from "../harness/approval-policy";
import type { WorkspaceRpc } from "../types";

const MAX_TOOL_OUTPUT_CHARS = 30_000;
const DEFAULT_COMMAND_TIMEOUT_SECONDS = 300;
const MAX_COMMAND_TIMEOUT_SECONDS = 1_800;

interface HarnessToolSpec<Input> {
  name: string;
  description: string;
  effect: HarnessToolEffect;
  input: z.ZodType<Input>;
  describe(input: Input): string;
  execute(input: Input, workspace: WorkspaceRpc): Promise<string>;
}

export interface PreparedToolCall {
  input: unknown;
  description: string;
  run(workspace: WorkspaceRpc): Promise<string>;
}

export interface HarnessTool {
  name: string;
  description: string;
  effect: HarnessToolEffect;
  inputSchema: z.ZodType;
  prepare(rawInput: unknown): PreparedToolCall;
}

function defineTool<Input>(spec: HarnessToolSpec<Input>): HarnessTool {
  return {
    name: spec.name,
    description: spec.description,
    effect: spec.effect,
    inputSchema: spec.input,
    prepare(rawInput) {
      const input = spec.input.parse(rawInput);

      return {
        input,
        description: spec.describe(input),
        run: (workspace) => spec.execute(input, workspace),
      };
    },
  };
}

function resolvePath(path: string | undefined): string {
  const value = path?.trim() || ".";

  return value.startsWith("/") ? value : `${WORKSPACE_ROOT}/${value.replace(/^\.\//, "")}`;
}

function limitOutput(value: string): string {
  return truncateText(value, MAX_TOOL_OUTPUT_CHARS);
}

async function runOrThrow(workspace: WorkspaceRpc, command: string): Promise<string> {
  const result = await workspace.exec(command, { timeoutMs: 60_000 });

  if (!result.success) {
    throw new Error(result.stderr.trim() || `Command failed with exit code ${result.exitCode}`);
  }

  return result.stdout;
}

const runCommand = defineTool({
  name: "run_command",
  description:
    "Run a shell command in the workspace, a Linux container with git, Node.js and Python. Returns the exit code and output.",
  effect: "execute",
  input: z.object({
    command: z.string().min(1).describe("The bash command to run."),
    cwd: z.string().optional().describe("Working directory, relative to /workspace."),
    timeout_seconds: z
      .number()
      .int()
      .min(1)
      .max(MAX_COMMAND_TIMEOUT_SECONDS)
      .optional()
      .describe("Seconds before the command is stopped."),
  }),
  describe: (input) => `Run \`${truncateText(input.command, 200)}\``,
  async execute(input, workspace) {
    const result = await workspace.exec(input.command, {
      cwd: resolvePath(input.cwd),
      timeoutMs: (input.timeout_seconds ?? DEFAULT_COMMAND_TIMEOUT_SECONDS) * 1000,
    });
    const output = [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n");

    return limitOutput(
      `exit_code=${result.exitCode}${result.timedOut ? " (timed out)" : ""}\n${output}`,
    );
  },
});

const readFile = defineTool({
  name: "read_file",
  description: "Read a text file from the workspace, optionally a range of lines.",
  effect: "read",
  input: z.object({
    path: z.string().min(1),
    start_line: z.number().int().min(1).optional(),
    line_count: z.number().int().min(1).max(5_000).optional(),
  }),
  describe: (input) => `Read ${input.path}`,
  async execute(input, workspace) {
    const content = await workspace.readFile(resolvePath(input.path));

    if (input.start_line === undefined && input.line_count === undefined) {
      return limitOutput(content);
    }

    const start = (input.start_line ?? 1) - 1;
    const lines = content.split("\n");

    return limitOutput(lines.slice(start, start + (input.line_count ?? lines.length)).join("\n"));
  },
});

const writeFile = defineTool({
  name: "write_file",
  description: "Create or replace a file in the workspace with the given content.",
  effect: "write",
  input: z.object({ path: z.string().min(1), content: z.string() }),
  describe: (input) => `Write ${input.path}`,
  async execute(input, workspace) {
    const path = resolvePath(input.path);

    await runOrThrow(workspace, `mkdir -p "$(dirname ${quoteShellArgument(path)})"`);
    await workspace.writeFile(path, input.content);

    return `Wrote ${input.content.length} characters to ${path}`;
  },
});

const editFile = defineTool({
  name: "edit_file",
  description:
    "Replace exact text in a workspace file. The old text must appear once unless replace_all is set.",
  effect: "write",
  input: z.object({
    path: z.string().min(1),
    old_text: z.string().min(1),
    new_text: z.string(),
    replace_all: z.boolean().optional(),
  }),
  describe: (input) => `Edit ${input.path}`,
  async execute(input, workspace) {
    const path = resolvePath(input.path);
    const content = await workspace.readFile(path);
    const occurrences = content.split(input.old_text).length - 1;

    if (occurrences === 0) {
      throw new Error(`The text to replace was not found in ${path}`);
    }

    if (occurrences > 1 && !input.replace_all) {
      throw new Error(
        `The text to replace appears ${occurrences} times in ${path}. Add context or set replace_all.`,
      );
    }

    await workspace.writeFile(
      path,
      input.replace_all
        ? content.replaceAll(input.old_text, input.new_text)
        : content.replace(input.old_text, input.new_text),
    );

    return `Replaced ${input.replace_all ? occurrences : 1} occurrence(s) in ${path}`;
  },
});

const listFiles = defineTool({
  name: "list_files",
  description: "List files under a workspace directory, skipping .git and node_modules.",
  effect: "read",
  input: z.object({
    path: z.string().optional(),
    depth: z.number().int().min(1).max(8).optional(),
  }),
  describe: (input) => `List ${input.path ?? "/workspace"}`,
  async execute(input, workspace) {
    return limitOutput(
      await runOrThrow(
        workspace,
        `find ${quoteShellArgument(resolvePath(input.path))} -maxdepth ${input.depth ?? 3} \\( -name .git -o -name node_modules \\) -prune -o -print | head -n 2000`,
      ),
    );
  },
});

const searchFiles = defineTool({
  name: "search_files",
  description: "Search workspace files for a regular expression and return matching lines.",
  effect: "read",
  input: z.object({
    pattern: z.string().min(1),
    path: z.string().optional(),
    glob: z.string().optional().describe("Only search files matching this glob."),
  }),
  describe: (input) => `Search for ${input.pattern}`,
  async execute(input, workspace) {
    const glob = input.glob ? ` --include=${quoteShellArgument(input.glob)}` : "";
    const result = await workspace.exec(
      `grep -rnE --exclude-dir=.git --exclude-dir=node_modules${glob} -e ${quoteShellArgument(input.pattern)} ${quoteShellArgument(resolvePath(input.path))} | head -n 500`,
      { timeoutMs: 60_000 },
    );

    return limitOutput(result.stdout.trim() || "No matches");
  },
});

export const WORKSPACE_TOOLS: readonly HarnessTool[] = [
  runCommand,
  readFile,
  writeFile,
  editFile,
  listFiles,
  searchFiles,
];
