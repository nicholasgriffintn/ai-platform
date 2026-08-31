import { describe, expect, it } from "vitest";

import { buildAgentTraceEntries } from "./agent-trace";
import type { Message } from "./conversation-types";

describe("buildAgentTraceEntries", () => {
  it("attributes an authored skill revision to its tool result", () => {
    const messages: Message[] = [
      {
        id: "assistant-1",
        role: "assistant",
        content: "",
        parts: [
          {
            type: "tool_result",
            name: "load_skill",
            toolCallId: "load-1",
            status: "success",
            data: {
              provenance: {
                source: "user-authored",
                scope: "project",
                skill: "release-checklist",
                revisionId: "revision-7",
                revision: 7,
              },
            },
          },
        ],
      },
    ];

    expect(buildAgentTraceEntries(messages)).toEqual([
      expect.objectContaining({
        type: "tool_result",
        provenance: {
          source: "user-authored",
          scope: "project",
          skill: "release-checklist",
          revisionId: "revision-7",
          revision: 7,
        },
      }),
    ]);
  });

  it("ignores provenance containing an extra internal field", () => {
    const messages: Message[] = [
      {
        id: "assistant-1",
        role: "assistant",
        content: "",
        parts: [
          {
            type: "tool_result",
            name: "load_skill",
            status: "success",
            data: {
              provenance: {
                source: "user-authored",
                scope: "personal",
                skill: "release-checklist",
                revisionId: "revision-7",
                revision: 7,
                userId: 42,
              },
            },
          },
        ],
      },
    ];

    expect(buildAgentTraceEntries(messages)[0]?.provenance).toBeUndefined();
  });

  it("ignores malformed provenance", () => {
    const messages: Message[] = [
      {
        id: "assistant-1",
        role: "assistant",
        content: "",
        parts: [
          {
            type: "tool_result",
            name: "load_skill",
            status: "success",
            data: {
              provenance: {
                source: "user-authored",
                scope: "personal",
                skill: "release-checklist",
                revisionId: "revision-7",
                revision: 0,
              },
            },
          },
        ],
      },
    ];

    expect(buildAgentTraceEntries(messages)[0]?.provenance).toBeUndefined();
  });

  it("does not attribute provenance-shaped data from another tool", () => {
    const messages: Message[] = [
      {
        id: "assistant-1",
        role: "assistant",
        content: "",
        parts: [
          {
            type: "tool_result",
            name: "search_documents",
            status: "success",
            data: {
              provenance: {
                source: "user-authored",
                scope: "project",
                skill: "release-checklist",
                revisionId: "revision-7",
                revision: 7,
              },
            },
          },
        ],
      },
    ];

    expect(buildAgentTraceEntries(messages)[0]?.provenance).toBeUndefined();
  });

  it("does not attribute provenance from a failed skill load", () => {
    const messages: Message[] = [
      {
        id: "assistant-1",
        role: "assistant",
        content: "",
        parts: [
          {
            type: "tool_result",
            name: "load_skill",
            status: "error",
            data: {
              provenance: {
                source: "user-authored",
                scope: "personal",
                skill: "release-checklist",
                revisionId: "revision-7",
                revision: 7,
              },
            },
          },
        ],
      },
    ];

    expect(buildAgentTraceEntries(messages)[0]?.provenance).toBeUndefined();
  });

  it("attributes an authored skill revision from a direct tool message", () => {
    const messages: Message[] = [
      {
        id: "tool-1",
        role: "tool",
        name: "load_skill",
        status: "success",
        content: "Loaded instructions",
        data: {
          provenance: {
            source: "user-authored",
            scope: "personal",
            skill: "release-checklist",
            revisionId: "revision-8",
            revision: 8,
          },
        },
      },
    ];

    expect(buildAgentTraceEntries(messages)).toEqual([
      expect.objectContaining({
        type: "tool_result",
        provenance: {
          source: "user-authored",
          scope: "personal",
          skill: "release-checklist",
          revisionId: "revision-8",
          revision: 8,
        },
      }),
    ]);
  });
});
