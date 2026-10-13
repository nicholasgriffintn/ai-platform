import { describe, expect, it } from "vitest";

import { parseInboundEmail } from "../email-payload";

const SIGNED_MESSAGE = [
  "DKIM-Signature: v=1; a=ed25519-sha256; c=relaxed/relaxed;",
  " d=football.example.com; i=@football.example.com;",
  " q=dns/txt; s=brisbane; t=1528637909; h=from : to :",
  " subject : date : message-id : from : subject : date;",
  " bh=2jUSOH9NhtVGCQWNr9BrIAPreKQjO6Sn7XIkfJVOzv8=;",
  " b=/gCrinpcQOoIfuHNQIbq4pgh9kyIK3AQUdt9OdqQehSwhEIug4D11Bus",
  " Fa3bT3FY5OsU7ZbnKELq+eXdp1Q1Dw==",
  "From: Joe SixPack <joe@football.example.com>",
  "To: Suzie Q <suzie@shopping.example.net>",
  "Subject: Is dinner ready?",
  "Date: Fri, 11 Jul 2003 21:00:37 -0700 (PDT)",
  "Message-ID: <20030712040037.46341.5F8J@football.example.com>",
  "",
  "Hi.",
  "",
  "We lost the game.  Are you hungry yet?",
  "",
  "Joe.",
  "",
].join("\r\n");

const INBOX = "suzie@shopping.example.net";
const resolveTxt = async (name: string) =>
  name === "brisbane._domainkey.football.example.com"
    ? ["v=DKIM1; k=ed25519; p=11qYAYKxCrfVS/7TyWQHOg7hcvPapiMlrwIaaPcHURo="]
    : [];
const encode = (value: string) => new TextEncoder().encode(value);

describe("parseInboundEmail", () => {
  it("admits a message signed by the sender's domain and addressed to the inbox", async () => {
    await expect(
      parseInboundEmail(encode(SIGNED_MESSAGE), { recipient: INBOX, resolveTxt }),
    ).resolves.toMatchObject({
      status: "message",
      incoming: {
        externalId: "joe@football.example.com",
        from: "joe@football.example.com",
        messageId: "<20030712040037.46341.5F8J@football.example.com>",
        context: {
          threadId: "<20030712040037.46341.5F8J@football.example.com>",
          isDirect: true,
          subject: "Is dinner ready?",
        },
      },
    });
  });

  it("refuses a signed message replayed to an inbox it was not addressed to", async () => {
    await expect(
      parseInboundEmail(encode(SIGNED_MESSAGE), {
        recipient: "poly@in.polychat.app",
        resolveTxt,
      }),
    ).resolves.toMatchObject({ status: "refused" });
  });

  it("refuses a message whose sender the signature does not cover", async () => {
    const spoofed = SIGNED_MESSAGE.replace(
      "From: Joe SixPack <joe@football.example.com>",
      "From: Owner <owner@victim.example>",
    );

    await expect(
      parseInboundEmail(encode(spoofed), { recipient: INBOX, resolveTxt }),
    ).resolves.toMatchObject({ status: "refused" });
  });

  it("ignores auto-replies so Poly cannot loop with an out-of-office", async () => {
    await expect(
      parseInboundEmail(encode(`Auto-Submitted: auto-replied\r\n${SIGNED_MESSAGE}`), {
        recipient: INBOX,
        resolveTxt,
      }),
    ).resolves.toMatchObject({ status: "ignored" });
  });
});
