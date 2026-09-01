import type { UsageEventRecord, UsageEventsResponse } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { flattenUsageEventPages, getNextUsageEventsPageParam } from "./usage-ledger";

function event(id: string): UsageEventRecord {
  return {
    id,
    occurred_at: "2026-08-30T12:00:00.000Z",
    period: "2026-08",
    source: "model",
    vendor: "anthropic",
    resource: "claude-haiku-4-5",
    unit: "input_tokens",
    quantity: 1200,
    cost_micros: 1200,
    credit_micros: 120000,
    credits: 0.12,
    billable: true,
    byok: false,
    estimated: false,
    conversation_id: null,
    project_id: null,
    workspace_id: null,
  };
}

function page(events: UsageEventRecord[], nextCursor: string | null): UsageEventsResponse {
  return { period: "2026-08", events, next_cursor: nextCursor };
}

describe("getNextUsageEventsPageParam", () => {
  it("continues from the cursor the API returned", () => {
    expect(getNextUsageEventsPageParam(page([event("a")], "cursor-2"))).toBe("cursor-2");
  });

  it("stops paginating when the cursor is null", () => {
    expect(getNextUsageEventsPageParam(page([event("a")], null))).toBeUndefined();
  });
});

describe("flattenUsageEventPages", () => {
  it("returns an empty ledger for missing pages", () => {
    expect(flattenUsageEventPages(undefined)).toEqual([]);
  });

  it("flattens pages in order and drops duplicate rows across page boundaries", () => {
    const pages = [
      page([event("a"), event("b")], "cursor-2"),
      page([event("b"), event("c")], null),
    ];

    expect(flattenUsageEventPages(pages).map((entry) => entry.id)).toEqual(["a", "b", "c"]);
  });
});
