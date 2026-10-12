import { Type } from "@earendil-works/pi-ai";
import type { Extension, ToolRegistration } from "@earendil-works/pi-durable";
import type { Plugin } from "@opencode/plugin";
import z from "zod/v4";

import type { HarnessTool } from "./workspace-tools";

export type RunHarnessTool = (tool: HarnessTool, rawInput: unknown) => Promise<string>;

const OPENCODE_REPLACED_TOOLS = new Set([
  "read",
  "write",
  "edit",
  "patch",
  "glob",
  "grep",
  "shell",
]);

export function toPiExtension(tools: readonly HarnessTool[], run: RunHarnessTool): Extension {
  const registrations: ToolRegistration[] = tools.map((definition) => ({
    name: definition.name,
    description: definition.description,
    parameters: Type.Unsafe(z.toJSONSchema(definition.inputSchema)),
    replay: definition.effect === "read" ? "safe" : "unsafe",
    executionMode: "sequential",
    async execute(args) {
      return { content: [{ type: "text", text: await run(definition, args) }] };
    },
  }));

  return { name: "polychat.workspace", tools: registrations, sections: [] };
}

export function toOpenCodePlugin(
  tools: readonly HarnessTool[],
  run: RunHarnessTool,
): Plugin.Plugin {
  return {
    id: "polychat.workspace",
    async setup(context) {
      const transform = await context.tool.transform((editor) => {
        for (const existing of editor.list()) {
          if (OPENCODE_REPLACED_TOOLS.has(existing.name)) {
            editor.remove(existing.id);
          }
        }

        for (const definition of tools) {
          editor.add({
            name: definition.name,
            description: definition.description,
            input: definition.inputSchema,
            execute: async (input) => ({ content: await run(definition, input) }),
          });
        }
      });

      return () => transform.dispose();
    },
  };
}
