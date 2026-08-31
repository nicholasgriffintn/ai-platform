import { SANDBOX_TASK_TYPES } from "@ngriffin_uk/polychat-schemas";

import { jsonSchemaToZod } from "../../../utils/jsonSchema";
import type { FunctionToolDescriptor } from "./types";

export const sandboxFunctionParameters = {
  type: "object",
  properties: {
    repo: {
      type: "string",
      description: "GitHub repository (format: owner/name)",
      pattern: "^[\\w.-]+/[\\w.-]+$",
    },
    task: {
      type: "string",
      description: "Task to run against the repository",
    },
    taskType: {
      type: "string",
      enum: SANDBOX_TASK_TYPES as unknown as string[],
      description:
        "The kind of work this is. Load the sandbox-tasks skill to choose: code-review and test-suite are read-only, the rest may change files.",
    },
    promptStrategy: {
      type: "string",
      description:
        "Optional prompting strategy (auto, feature-delivery, bug-fix, refactor, test-hardening)",
    },
    shouldCommit: {
      type: "boolean",
      description:
        "Whether to create a commit inside the sandbox repository after applying changes",
    },
    timeoutSeconds: {
      type: "number",
      description: "Optional sandbox run timeout in seconds",
    },
    installationId: {
      type: "number",
      description: "Optional GitHub App installation ID to force a specific connection",
    },
  },
  required: ["task", "taskType"],
} as const;

export const run_sandbox_task: FunctionToolDescriptor = {
  name: "run_sandbox_task",
  description:
    "Run a coding task against a GitHub repository in the sandbox worker. Covers implementation, bug fixes, refactoring, migrations, documentation, code review and test runs; the task type decides whether the run may change files. Load the sandbox-tasks skill before calling this to pick the type and write the task properly.",
  type: "premium",
  costPerCall: 0.1,
  permissions: ["sandbox", "write"],
  inputSchema: jsonSchemaToZod(sandboxFunctionParameters),
};
