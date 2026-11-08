import { describe, expect, it } from "vitest";

import { connectorOperationRequiresApproval } from "../policy.js";

describe("Composio operation policy metadata", () => {
  it("requires approval for writes, destructive reads, and unknown operations", () => {
    expect(connectorOperationRequiresApproval("gmail", "GMAIL_FETCH_EMAILS")).toBe(false);
    expect(connectorOperationRequiresApproval("gmail", "GMAIL_CREATE_EMAIL_DRAFT")).toBe(true);
    expect(connectorOperationRequiresApproval("linear", "LINEAR_RUN_QUERY_OR_MUTATION")).toBe(true);
    expect(connectorOperationRequiresApproval("gmail", "GMAIL_UNKNOWN_OPERATION")).toBe(true);
  });

  it("lets an agent's own mailbox send and reply without a person", () => {
    expect(connectorOperationRequiresApproval("agent_mail", "AGENT_MAIL_SEND_EMAIL")).toBe(false);
    expect(connectorOperationRequiresApproval("agent_mail", "AGENT_MAIL_REPLY_TO_MESSAGE")).toBe(
      false,
    );
    expect(connectorOperationRequiresApproval("agent_mail", "AGENT_MAIL_UNKNOWN")).toBe(true);
  });
});
