import type { UsageEventRecord, UsageEventsResponse } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { flattenUsageEventPages } from "../chat/usage-ledger.js";

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
    vendor_units: null,
    reason: null,
    site: null,
    conversation_id: null,
    project_id: null,
    workspace_id: null,
  };
}

function page(events: UsageEventRecord[], hasMore: boolean): UsageEventsResponse {
  return {
    object: "list",
    data: events,
    has_more: hasMore,
    last_id: events.at(-1)?.id ?? null,
    period: "2026-08",
  };
}

describe("flattenUsageEventPages", () => {
  it("returns an empty ledger for missing pages", () => {
    expect(flattenUsageEventPages(undefined)).toEqual([]);
  });

  it("flattens pages in order and drops duplicate rows across page boundaries", () => {
    const pages = [page([event("a"), event("b")], true), page([event("b"), event("c")], false)];

    expect(flattenUsageEventPages(pages).map((entry) => entry.id)).toEqual(["a", "b", "c"]);
  });
});
