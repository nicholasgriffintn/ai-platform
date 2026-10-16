import { describe, expect, it, vi } from "vitest";

import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { ConversationRunRepository } from "~/modules/conversations/infrastructure/ConversationRunRepository";
import type { ChatCompletionParameters } from "~/types";

import { executeMachineChatResponse } from "../chat-response";

const callMachineRun = vi.hoisted(() => vi.fn());

vi.mock("../runs", () => ({ callMachineRun }));
vi.mock("@ngriffin_uk/polychat-utility-core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-utility-core")>()),
  abortableDelay: vi.fn(async () => undefined),
}));

function snapshot(state: string, text: string) {
  return new Response(JSON.stringify({ id: "6f1c2b3a-4d5e-4f60-8a71-92b3c4d5e6f7", state, text }));
}

async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  return new Response(stream).text();
}

describe("executeMachineChatResponse", () => {
  it("streams only the new text from each machine snapshot", async () => {
    callMachineRun
      .mockResolvedValueOnce(snapshot("running", "Hel"))
      .mockResolvedValueOnce(snapshot("running", "Hel"))
      .mockResolvedValueOnce(snapshot("completed", "Hello"));

    const params = {
      stream: true,
      completion_id: "conversation-1",
      messages: [{ role: "user", content: "Hi" }],
      context: {
        user: { id: 7 },
        executionRunId: undefined,
        repositories: fakeRepositories([[ConversationRunRepository, { getById: vi.fn() }]]),
      },
    } as unknown as ChatCompletionParameters;

    const stream = await executeMachineChatResponse(params, {
      id: "machine/desktop-1/ollama/gemma3:1b",
      matchingModel: "gemma3:1b",
      provider: "ollama",
      machineId: "desktop-1",
    });

    expect(stream).toBeInstanceOf(ReadableStream);
    expect(await readStream(stream as ReadableStream<Uint8Array>)).toBe(
      [
        'data: {"type":"response.output_text.delta","delta":"Hel"}',
        'data: {"type":"response.output_text.delta","delta":"lo"}',
        "data: [DONE]",
        "",
      ].join("\n\n"),
    );
  });
});
