import {
  isForwardedEmail,
  stripQuotedEmailReply,
} from "@ngriffin_uk/polychat-utility-server/email-text";
import { htmlToPlainText } from "@ngriffin_uk/polychat-utility-server/html-text";
import PostalMime, { type Address, type Attachment, type Email } from "postal-mime";

const MAX_BODY_CHARACTERS = 20_000;
const MAX_ATTACHED_MESSAGES = 5;
const ATTACHED_MESSAGE_TYPES = new Set(["message/rfc822", "message/global"]);
const ATTACHED_MESSAGE_MARKER = "---------- Attached message ----------";

function bodyText(email: Email): string {
  const text = email.text?.trim() ? email.text : htmlToPlainText(email.html ?? "");

  return text.replace(/\r\n?/g, "\n").trim();
}

function mailboxLabel(address: Address | undefined): string | undefined {
  if (address?.address) {
    return address.name ? `${address.name} <${address.address}>` : address.address;
  }

  return address?.name || undefined;
}

function isAttachedMessage(attachment: Attachment): boolean {
  return (
    ATTACHED_MESSAGE_TYPES.has(attachment.mimeType.toLowerCase()) && !attachment.rfc822DepthExceeded
  );
}

async function renderAttachedMessage(attachment: Attachment): Promise<string | null> {
  const attached = await PostalMime.parse(attachment.content, { maxRfc822NestingDepth: 0 }).catch(
    () => null,
  );

  if (!attached) {
    return null;
  }

  const headers = [
    { name: "From", value: mailboxLabel(attached.from) },
    { name: "Date", value: attached.date },
    { name: "Subject", value: attached.subject },
  ].flatMap(({ name, value }) => (value?.trim() ? [`${name}: ${value.trim()}`] : []));

  return [ATTACHED_MESSAGE_MARKER, ...headers, "", bodyText(attached)].join("\n").trim();
}

export async function readEmailContent(email: Email): Promise<string> {
  const text = bodyText(email);
  const own = isForwardedEmail(email.subject, text) ? text : stripQuotedEmailReply(text);
  const attached = await Promise.all(
    email.attachments
      .filter(isAttachedMessage)
      .slice(0, MAX_ATTACHED_MESSAGES)
      .map(renderAttachedMessage),
  );

  return [own, ...attached]
    .filter((part): part is string => Boolean(part))
    .join("\n\n")
    .slice(0, MAX_BODY_CHARACTERS);
}
