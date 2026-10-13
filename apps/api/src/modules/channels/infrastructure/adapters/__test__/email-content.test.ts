import PostalMime from "postal-mime";
import { describe, expect, it } from "vitest";

import { readEmailContent } from "../email-content";

function message(headers: string[], body: string[]): string {
  return [...headers, "", ...body, ""].join("\r\n");
}

async function contentOf(raw: string): Promise<string> {
  return readEmailContent(await PostalMime.parse(raw));
}

describe("readEmailContent", () => {
  it("keeps the forwarded message below an Outlook separator", async () => {
    const content = await contentOf(
      message(
        ["From: me@example.com", "Subject: FW: Invoice 42", "Content-Type: text/plain"],
        [
          "Can you file this?",
          "",
          "________________________________",
          "From: Billing <billing@supplier.test>",
          "Subject: Invoice 42",
          "",
          "Amount due: 120 GBP by 31 October.",
        ],
      ),
    );

    expect(content).toContain("Can you file this?");
    expect(content).toContain("Amount due: 120 GBP by 31 October.");
  });

  it("still drops quoted history from an ordinary reply", async () => {
    const content = await contentOf(
      message(
        ["From: me@example.com", "Subject: Re: Lunch", "Content-Type: text/plain"],
        [
          "Thursday works.",
          "",
          "On Tue, 7 Oct 2026 at 10:00, Poly <noreply@email.polychat.app> wrote:",
          "> Shall I book lunch?",
        ],
      ),
    );

    expect(content).toBe("Thursday works.");
  });

  it("reads a message forwarded as an attachment", async () => {
    const attached = message(
      [
        "From: Billing <billing@supplier.test>",
        "Subject: Invoice 42",
        "Date: Mon, 6 Oct 2026 09:00:00 +0000",
        "Content-Type: text/plain",
      ],
      ["Amount due: 120 GBP by 31 October."],
    );
    const content = await contentOf(
      message(
        [
          "From: me@example.com",
          "Subject: Invoice 42",
          'Content-Type: multipart/mixed; boundary="outer"',
        ],
        [
          "--outer",
          "Content-Type: text/plain",
          "",
          "Can you file this?",
          "--outer",
          "Content-Type: message/rfc822",
          'Content-Disposition: attachment; filename="invoice.eml"',
          "",
          attached,
          "--outer--",
        ],
      ),
    );

    expect(content).toContain("Can you file this?");
    expect(content).toContain("From: Billing <billing@supplier.test>");
    expect(content).toContain("Amount due: 120 GBP by 31 October.");
  });
});
