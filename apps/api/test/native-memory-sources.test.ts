import type { D1Database } from "@cloudflare/workers-types";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { MessageRepository } from "~/modules/conversations/infrastructure/MessageRepository";
import {
  MEMORY_REFLECTION_MAX_OUTPUT_TOKENS,
  memoryReflectionInputTokens,
  memoryReflectionSourceTokenBudget,
} from "~/modules/memory-documents/application/reflection-prompt";
import { applyMemoryReflectionProposal } from "~/modules/memory-documents/application/reflection-proposal";
import { selectMemoryReflectionSources } from "~/modules/memory-documents/application/reflection-sources";

import { databaseTestEnvironment } from "./helpers/environment";
import { initialiseNativeMemoryDatabase } from "./helpers/native-memory-database";

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});
let database: D1Database;
let messages: MessageRepository;
const range = {
  conversationId: "conversation",
  contextId: "context",
  userId: 1,
  afterMessageId: null,
  throughMessageId: "last",
};

beforeAll(async () => {
  database = await runtime.getD1Database("DB");
  await initialiseNativeMemoryDatabase(database);
  messages = new MessageRepository(databaseTestEnvironment(database));
});
beforeEach(async () => {
  await database.batch([
    database.prepare("DELETE FROM message"),
    database.prepare("DELETE FROM conversation_run"),
  ]);
});
afterAll(async () => {
  await runtime.dispose();
});

describe("trusted maintenance source ranges", () => {
  it("accepts the context owner's input and excludes automated, foreign and tool messages", async () => {
    await database.batch([
      ...[
        ["trusted", "conversation", "context", 1, "user"],
        ["timer", "conversation", "context", 1, "scheduled"],
        ["other-user", "conversation", "context", 2, "user"],
        ["other-context", "conversation", "foreign", 1, "user"],
        ["other-conversation", "foreign", "context", 1, "user"],
      ].map((values) =>
        database
          .prepare(
            "INSERT INTO conversation_run (id, conversation_id, teammate_context_id, initiator_user_id, trigger) VALUES (?, ?, ?, ?, ?)",
          )
          .bind(...values),
      ),
      ...[
        ["legacy", null, "user"],
        ["current", "trusted", "user"],
        ["automatic", "timer", "user"],
        ["another", "other-user", "user"],
        ["foreign-context", "other-context", "user"],
        ["foreign-conversation", "other-conversation", "user"],
        ["model", "trusted", "assistant"],
        ["last", "trusted", "tool"],
      ].map(([id, runId, role], index) =>
        database
          .prepare(
            "INSERT INTO message (id, conversation_id, run_id, role, content, timestamp) VALUES (?, 'conversation', ?, ?, ?, ?)",
          )
          .bind(id, runId, role, `Evidence ${id}`, index),
      ),
    ]);
    const rows = await messages.getMemoryReflectionMessages(range);
    const selected = selectMemoryReflectionSources(rows);

    expect(selected.sources.map((source) => source.id)).toEqual(["current"]);
    expect(selected.throughMessageId).toBe("last");
    const trigger = { conversationId: "conversation", contextId: "context", userId: 1 };

    expect(await messages.getMemoryReflectionInput({ ...trigger, runId: "trusted" })).toMatchObject(
      {
        id: "current",
      },
    );

    for (const runId of ["timer", "other-user", "other-context", "other-conversation"]) {
      expect(await messages.getMemoryReflectionInput({ ...trigger, runId })).toBeNull();
    }
  });

  it("uses the conversation's stable ordering and bounds each database batch", async () => {
    await database.batch(
      Array.from({ length: 70 }, (_, index) =>
        database
          .prepare(
            "INSERT INTO message (id, conversation_id, role, content, timestamp) VALUES (?, 'conversation', 'user', 'A stable preference', ?)",
          )
          .bind(`message-${index}`, index),
      ),
    );
    const first = await messages.getMemoryReflectionMessages({
      ...range,
      throughMessageId: "message-69",
    });

    expect(first).toHaveLength(64);
    expect(first.at(-1)?.id).toBe("message-63");
    const second = await messages.getMemoryReflectionMessages({
      ...range,
      afterMessageId: "message-63",
      throughMessageId: "message-69",
    });

    expect(second.map((row) => row.id)).toEqual(
      Array.from({ length: 6 }, (_, index) => `message-${index + 64}`),
    );
  });
});

describe("maintenance content boundaries", () => {
  it("redacts recognised credentials before they become model evidence", () => {
    const selected = selectMemoryReflectionSources([
      {
        id: "source",
        role: "user",
        content: "Use concise answers. password=synthetic-secret",
        reflection_source_trusted: 1,
      },
      { id: "last", role: "tool", content: "Untrusted text", reflection_source_trusted: 0 },
    ]);

    expect(selected.sources).toEqual([
      { id: "source", text: "Use concise answers. password=[redacted]" },
    ]);
    expect(selected.throughMessageId).toBe("last");
  });

  it("fits a smaller model without losing the next source and refuses one oversized source", () => {
    const memory = "Existing memory. ".repeat(700);
    const rows = [
      { id: "first", role: "user", content: "a".repeat(8000), reflection_source_trusted: 1 },
      { id: "next", role: "user", content: "b".repeat(8000), reflection_source_trusted: 1 },
    ];
    const budget = memoryReflectionSourceTokenBudget(memory, 8000);
    const selected = selectMemoryReflectionSources(rows, budget);

    expect(selected.throughMessageId).toBe("first");
    expect(
      memoryReflectionInputTokens(memory, selected.sources) + MEMORY_REFLECTION_MAX_OUTPUT_TOKENS,
    ).toBeLessThanOrEqual(8000);
    expect(
      selectMemoryReflectionSources(rows.slice(1), budget).sources.map((source) => source.id),
    ).toEqual(["next"]);
    expect(() =>
      selectMemoryReflectionSources([{ ...rows[0], content: "a".repeat(24001) }]),
    ).toThrow("budget");
  });

  it.each(["password=synthetic-secret", "password=[redacted]"])(
    "refuses retaining a credential or redaction marker: %s",
    (after) => {
      expect(() =>
        applyMemoryReflectionProposal(
          "",
          {
            edits: [
              {
                before: "",
                after,
                evidence: [{ messageId: "source", quote: "Use concise answers" }],
              },
            ],
            changeNote: "New preference",
          },
          [{ id: "source", text: "Use concise answers" }],
        ),
      ).toThrow("credentials");
    },
  );
});
