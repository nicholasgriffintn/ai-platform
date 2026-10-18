import { describe, expect, it } from "vitest";

import { classifyOperationEffect } from "../operation-effects.js";

describe("classifyOperationEffect", () => {
  it("classes sends, deletes, payments and exports from the verb", () => {
    expect(classifyOperationEffect("GMAIL_SEND_EMAIL")).toBe("external_send");
    expect(classifyOperationEffect("SLACK_SEND_MESSAGE")).toBe("external_send");
    expect(classifyOperationEffect("LINEAR_DELETE_ISSUE")).toBe("destructive");
    expect(classifyOperationEffect("STRIPE_REFUND_CHARGE")).toBe("spend");
    expect(classifyOperationEffect("GOOGLEDRIVE_DOWNLOAD_FILE")).toBe("data_export");
  });

  it("keeps reads as reads even when the object sounds risky", () => {
    expect(classifyOperationEffect("GMAIL_FETCH_EMAILS")).toBe("read");
    expect(classifyOperationEffect("STRIPE_LIST_PAYMENTS")).toBe("read");
    expect(classifyOperationEffect("SLACK_LIST_MESSAGES")).toBe("read");
  });

  it("escalates credential handling and payments from the object", () => {
    expect(classifyOperationEffect("GITHUB_GET_TOKEN")).toBe("credential");
    expect(classifyOperationEffect("STRIPE_CREATE_PAYMENT_INTENT")).toBe("spend");
    expect(classifyOperationEffect("rotate_api_key")).toBe("credential");
  });

  it("falls back to write for ordinary changes and unknown shapes", () => {
    expect(classifyOperationEffect("GITHUB_CREATE_AN_ISSUE")).toBe("write");
    expect(classifyOperationEffect("NOTION_UPDATE_PAGE")).toBe("write");
    expect(classifyOperationEffect("mystery")).toBe("write");
    expect(classifyOperationEffect("mystery", "read")).toBe("read");
  });

  it("reads camel case and kebab case MCP tool names", () => {
    expect(classifyOperationEffect("sendSlackMessage")).toBe("external_send");
    expect(classifyOperationEffect("delete-record")).toBe("destructive");
    expect(classifyOperationEffect("searchIssues")).toBe("read");
  });
});
