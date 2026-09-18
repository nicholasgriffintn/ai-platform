import type { ChatCompletionParameters, ProviderRuntime } from "@ngriffin_uk/polychat-ai-providers";
import { defineTool } from "@ngriffin_uk/polychat-library-tools";
import { describe, expect, it, vi } from "vitest";
import z from "zod/v4";

import { Agent, parseAgentToolCalls } from "../agent.js";

const env = {};

function createRuntime(responses: Array<Record<string, unknown>>) {
  const getResponse = vi.fn<(params: ChatCompletionParameters) => Promise<Record<string, unknown>>>(
    async () => {
      const next = responses.shift();

      if (!next) {
        throw new Error("no scripted response left");
      }

      return next;
    },
  );
  const runtime: ProviderRuntime = {
    host: {
      models: {
        findModelConfig: vi.fn(
          async () => ({ matchingModel: "gpt-5", provider: "openai" }) as never,
        ),
      } as never,
      storage: { forEnv: () => null, forContext: () => null },
      keyStore: () => undefined,
    },
    providers: {
      resolve: (() => ({ name: "openai", supportsStreaming: false, getResponse })) as never,
    },
  };

  return { runtime, getResponse };
}

const lookup = defineTool({
  name: "lookup_perch",
  description: "Find a perch",
  type: "normal",
  permissions: ["read"],
  inputSchema: z.object({ branch: z.string() }),
  execute: async (input) => ({ content: `perch on ${input.branch}` }),
});

const toolCall = (name: string, args: Record<string, unknown>, id = `${name}-1`) => ({
  id,
  type: "function",
  function: { name, arguments: JSON.stringify(args) },
});

describe("Agent", () => {
  it("runs the decision loop, executes tools, and finishes with a summary", async () => {
    const { runtime, getResponse } = createRuntime([
      { response: "", tool_calls: [toolCall("lookup_perch", { branch: "oak" })] },
      { response: "", tool_calls: [toolCall("finish", { summary: "Found a perch on the oak." })] },
    ]);
    const events: string[] = [];
    const agent = Agent(
      {
        name: "Scout",
        role: "a scouting parrot",
        objective: "find a perch",
        model: "gpt-5",
        tools: [lookup],
      },
      runtime,
    );

    const result = await agent.run({
      env,
      prompt: "Where should we perch?",
      context: { completionId: "c1", env },
      emit: (event) => void events.push(event.type),
    });

    expect(result.summary).toBe("Found a perch on the oak.");
    expect(result.toolCalls).toBe(1);
    expect(result.stepsTaken).toBe(2);
    expect(events).toContain("agent.tool");

    const firstParams = getResponse.mock.calls[0]?.[0];

    expect(firstParams?.messages?.[0]).toMatchObject({ role: "system" });
    expect(
      firstParams?.available_functions?.map((tool) =>
        "function" in tool ? tool.function.name : tool.name,
      ),
    ).toEqual(["lookup_perch", "update_plan", "finish"]);

    const toolMessage = result.messages.find((message) => message.role === "tool");

    expect(toolMessage).toMatchObject({
      name: "lookup_perch",
      content: "perch on oak",
      status: "success",
    });
  });

  it("reports unknown tools and invalid input back to the model instead of crashing", async () => {
    const { runtime } = createRuntime([
      { response: "", tool_calls: [toolCall("fly_away", {}), toolCall("lookup_perch", {}, "bad")] },
      { response: "", tool_calls: [toolCall("finish", { summary: "done" })] },
    ]);
    const agent = Agent({ name: "Scout", model: "gpt-5", tools: [lookup] }, runtime);

    const result = await agent.run({ env, prompt: "go", context: { completionId: "c2", env } });
    const toolMessages = result.messages.filter(
      (message) => message.role === "tool" && message.name !== "finish",
    );

    expect(toolMessages.map((message) => message.status)).toEqual(["error", "error"]);
    expect(String(toolMessages[0]?.content)).toContain('Unknown tool "fly_away"');
    expect(String(toolMessages[1]?.content)).toContain("Invalid arguments for lookup_perch");
  });

  it("runs a single tool directly", async () => {
    const { runtime } = createRuntime([]);
    const agent = Agent({ name: "Scout", model: "gpt-5", tools: [lookup] }, runtime);

    await expect(
      agent.do("lookup_perch", { branch: "elm" }, { completionId: "c3", env }),
    ).resolves.toEqual({ content: "perch on elm" });
  });

  it("parses provider tool calls into agent tool calls", () => {
    expect(parseAgentToolCalls({ tool_calls: [toolCall("a", { x: 1 })] })).toEqual([
      expect.objectContaining({ id: "a-1", name: "a", arguments: { x: 1 } }),
    ]);
    expect(parseAgentToolCalls({ response: "text" })).toEqual([]);
  });
});
