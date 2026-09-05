import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import {
  createChatStreamAssembler,
  parseChatStreamSseBuffer,
  type ChatStreamUpdate,
  type ParsedChatStreamSseEvent,
} from "./chat-stream";

interface ConformanceExpectation {
  eventTypes: string[];
  updateTypes: string[];
  assistantFinalContents: string[];
  toolResultStatuses: string[];
  activityKinds: string[];
  doneCount: number;
  finalContent?: string;
  remainingBuffer: string;
}

interface ConformanceCase {
  name: string;
  chunks: string[];
  flush: boolean;
  expected: ConformanceExpectation;
}

interface ConformanceCorpus {
  version: number;
  cases: ConformanceCase[];
}

const corpus = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../fixtures/chat-stream-conformance.json", import.meta.url)),
    "utf8",
  ),
) as ConformanceCorpus;

function runFixture(fixture: ConformanceCase) {
  const assembler = createChatStreamAssembler({
    model: "fixture-model",
    createId: vi.fn(() => "generated-fixture-id"),
    now: vi.fn(() => 1234),
  });
  const events: ParsedChatStreamSseEvent[] = [];
  const updates: ChatStreamUpdate[] = [];
  let remainingBuffer = "";

  for (const chunk of fixture.chunks) {
    const parsed = parseChatStreamSseBuffer(`${remainingBuffer}${chunk}`);

    events.push(...parsed.events);
    remainingBuffer = parsed.remainingBuffer;
  }

  if (fixture.flush) {
    const parsed = parseChatStreamSseBuffer(remainingBuffer, { flush: true });

    events.push(...parsed.events);
    remainingBuffer = parsed.remainingBuffer;
  }

  for (const event of events) {
    updates.push(...assembler.ingest(event));
  }

  return { assembler, events, remainingBuffer, updates };
}

function fixtureNamed(name: string): ConformanceCase {
  const fixture = corpus.cases.find((candidate) => candidate.name === name);

  if (!fixture) {
    throw new Error(`Missing chat stream conformance fixture: ${name}`);
  }

  return fixture;
}

describe("chat stream conformance corpus", () => {
  it("keeps the fixture version explicit", () => {
    expect(corpus.version).toBe(2);
  });

  it.each(corpus.cases)("conforms for $name", (fixture) => {
    const { assembler, events, remainingBuffer, updates } = runFixture(fixture);
    const eventTypes = events.map((event) => event.type);
    const assistantFinalContents = updates.flatMap((update) =>
      update.type === "assistant_final" ? [String(update.message.content)] : [],
    );
    const toolResultStatuses = updates.flatMap((update) =>
      update.type === "tool_result" ? [update.message.status ?? ""] : [],
    );
    const activityKinds = updates.flatMap((update) =>
      update.type === "activity" ? [update.activity.kind] : [],
    );

    expect(eventTypes).toEqual(fixture.expected.eventTypes);
    expect(updates.map((update) => update.type)).toEqual(fixture.expected.updateTypes);
    expect(assistantFinalContents).toEqual(fixture.expected.assistantFinalContents);
    expect(toolResultStatuses).toEqual(fixture.expected.toolResultStatuses);
    expect(activityKinds).toEqual(fixture.expected.activityKinds);
    expect(updates.filter((update) => update.type === "done")).toHaveLength(
      fixture.expected.doneCount,
    );
    expect(remainingBuffer).toBe(fixture.expected.remainingBuffer);

    if ("finalContent" in fixture.expected) {
      expect(assembler.getFinalMessage()?.content).toBe(fixture.expected.finalContent);
    } else {
      expect(assembler.getFinalMessage()).toBeUndefined();
    }
  });

  it("preserves reasoning, usage, and assistant metadata across additive events", () => {
    const fixture = fixtureNamed("text_reasoning_metadata_and_unknown_event");
    const { assembler } = runFixture(fixture);

    expect(assembler.getFinalMessage()).toMatchObject({
      id: "assistant-text",
      content: "Hello world",
      model: "model-a",
      provider: "provider-a",
      platform: "cloud",
      reasoning: { collapsed: false, content: "Checking context. " },
      usage: { input_tokens: 12, output_tokens: 2 },
    });
  });

  it("assembles interleaved tool arguments without crossing call boundaries", () => {
    const fixture = fixtureNamed("parallel_tools_with_fragmented_arguments_and_mixed_results");
    const { updates } = runFixture(fixture);
    const firstAssistant = updates.find((update) => update.type === "assistant_final");

    expect(firstAssistant).toMatchObject({
      type: "assistant_final",
      message: {
        tool_calls: [
          { id: "call-clock", function: { name: "clock", arguments: { zone: "UTC" } } },
          {
            id: "call-weather",
            function: { name: "weather", arguments: { city: "London" } },
          },
        ],
      },
    });
  });

  it("preserves malformed tool arguments for downstream validation", () => {
    const fixture = fixtureNamed("sequential_tool_with_malformed_arguments");
    const { updates } = runFixture(fixture);
    const assistantFinals = updates.filter((update) => update.type === "assistant_final");

    expect(assistantFinals[1]?.message.tool_calls?.[0]?.function.arguments).toBe(
      '{"path":not-json}',
    );
  });
});
