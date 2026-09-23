import { jsonSchemaToZod } from "@ngriffin_uk/polychat-library-tools";

import type { FunctionToolDescriptor } from "./types";

export const RUN_CODE_TOOL_NAME = "run_code";

export const run_code: FunctionToolDescriptor = {
  name: RUN_CODE_TOOL_NAME,
  description:
    "Run JavaScript in an isolated sandbox and return the value it produces. Write the body of an async function: the last `return` is the result and console output is captured. Name the tools the code may call in `tools`; each becomes `await tools.<name>(args)` inside the script with the same arguments as calling the tool directly. Use it to combine several tool calls, filter or reshape large results, or do calculations without round-tripping through the conversation. There is no network access unless `network` lists the hosts to allow.",
  type: "normal",
  permissions: ["sandbox"],
  maxIdenticalCalls: 3,
  intentEvidence: (input) => ({
    operation: "run_code",
    tools: input.tools ?? [],
    network: input.network ?? [],
    timeoutMs: input.timeout_ms ?? 5_000,
  }),
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      code: {
        type: "string",
        description: "The body of an async JavaScript function. Return the value you want back.",
      },
      tools: {
        type: "array",
        items: { type: "string" },
        description: "Names of tools the code may call through `tools.<name>(args)`.",
      },
      network: {
        type: "array",
        items: { type: "string" },
        description:
          'Hostnames the code may fetch from, for example ["api.github.com"]. Omit to block all network access.',
      },
      timeout_ms: {
        type: "number",
        description: "Maximum run time in milliseconds (default 5000, max 60000).",
        minimum: 100,
        maximum: 60000,
      },
    },
    required: ["code"],
  }),
};
