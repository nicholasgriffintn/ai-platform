import { emailChannelAddressSchema } from "@ngriffin_uk/polychat-schemas";
import {
  isDkimAligned,
  type TxtResolver,
  verifyDkimSignatures,
} from "@ngriffin_uk/polychat-utility-server/dkim";
import {
  parseMessageIds,
  stripQuotedEmailReply,
} from "@ngriffin_uk/polychat-utility-server/email-text";
import { htmlToPlainText } from "@ngriffin_uk/polychat-utility-server/html-text";
import PostalMime, { addressParser, type Email } from "postal-mime";

import type { ChannelIncomingMessage } from "../../application/ports/channel-adapter";

const MAX_BODY_CHARACTERS = 20_000;
const MAX_HEADER_ID_LENGTH = 998;
const PAIRING_LINE_PATTERN = /^\/polychat-link [a-f0-9]{64}$/;
const AUTOMATED_PRECEDENCE = new Set(["bulk", "junk", "list", "auto_reply"]);

export type EmailIntake =
  | { status: "message"; incoming: ChannelIncomingMessage }
  | { status: "ignored"; reason: string }
  | { status: "refused"; reason: string };

function headerValues(email: Email, key: string): string[] {
  return email.headers.filter((header) => header.key === key).map((header) => header.value.trim());
}

function senderAddress(email: Email): string | null {
  const fromHeaders = headerValues(email, "from");

  if (fromHeaders.length !== 1) {
    return null;
  }

  const addresses = addressParser(fromHeaders[0], { flatten: true });
  const address = addresses.length === 1 ? addresses[0].address?.toLowerCase() : undefined;

  return address && emailChannelAddressSchema.safeParse(address).success ? address : null;
}

function recipientHeaders(email: Email, recipient: string): string[] | null {
  const fields = ["to", "cc"].map((key) => ({ key, values: headerValues(email, key) }));

  if (fields.some((field) => field.values.length > 1)) {
    return null;
  }

  return fields
    .filter((field) =>
      field.values
        .flatMap((value) => addressParser(value, { flatten: true }))
        .some((address) => address.address?.toLowerCase() === recipient),
    )
    .map((field) => field.key);
}

function isAutomated(email: Email): boolean {
  const autoSubmitted = headerValues(email, "auto-submitted").some(
    (value) => value.toLowerCase() !== "no",
  );
  const precedence = headerValues(email, "precedence").some((value) =>
    AUTOMATED_PRECEDENCE.has(value.toLowerCase()),
  );

  return (
    autoSubmitted ||
    precedence ||
    headerValues(email, "x-autoreply").length > 0 ||
    headerValues(email, "x-autorespond").length > 0
  );
}

function threadRoot(email: Email, messageId: string): string {
  const [root] = [...parseMessageIds(email.references), ...parseMessageIds(email.inReplyTo)];

  return root && root.length <= MAX_HEADER_ID_LENGTH ? root : messageId;
}

function readableText(email: Email): string {
  const text = email.text?.trim() ? email.text : htmlToPlainText(email.html ?? "");

  return stripQuotedEmailReply(text).slice(0, MAX_BODY_CHARACTERS);
}

function pairingCommand(subject: string, text: string): string | null {
  const candidates = [subject, text.split("\n").find((line) => line.trim()) ?? ""];

  return (
    candidates.map((value) => value.trim()).find((value) => PAIRING_LINE_PATTERN.test(value)) ??
    null
  );
}

export async function parseInboundEmail(
  raw: Uint8Array,
  options: { recipient: string; resolveTxt: TxtResolver },
): Promise<EmailIntake> {
  const email = await PostalMime.parse(raw);
  const from = senderAddress(email);

  if (!from) {
    return { status: "refused", reason: "The message needs exactly one sender address" };
  }

  if (isAutomated(email)) {
    return { status: "ignored", reason: "automated_message" };
  }

  const addressedBy = recipientHeaders(email, options.recipient.toLowerCase());

  if (!addressedBy?.length) {
    return { status: "refused", reason: "Address Polychat in To or Cc rather than Bcc" };
  }

  const fromDomain = from.slice(from.lastIndexOf("@") + 1);
  const signatures = await verifyDkimSignatures(raw, options.resolveTxt);
  const verified = signatures.some(
    (signature) =>
      isDkimAligned(fromDomain, signature.domain) &&
      addressedBy.some((header) => signature.signedHeaders.includes(header)),
  );

  if (!verified) {
    return { status: "refused", reason: "Polychat could not verify who sent this message" };
  }

  const [messageId] = parseMessageIds(email.messageId);

  if (!messageId || messageId.length > MAX_HEADER_ID_LENGTH) {
    return { status: "refused", reason: "The message has no Message-ID" };
  }

  const subject = email.subject?.trim().slice(0, MAX_HEADER_ID_LENGTH) ?? "";
  const text = readableText(email);
  const command = pairingCommand(subject, text);
  const body = command ?? (subject ? `Subject: ${subject}\n\n${text}` : text).trim();

  if (!body) {
    return { status: "ignored", reason: "empty_message" };
  }

  return {
    status: "message",
    incoming: {
      kind: "message",
      messageId,
      externalId: from,
      from,
      body,
      context: {
        externalId: from,
        threadId: threadRoot(email, messageId),
        isDirect: true,
        ...(subject ? { subject } : {}),
      },
    },
  };
}
