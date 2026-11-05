import { toPlainChannelLine } from "@ngriffin_uk/polychat-utility-core";

const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_LENGTH = 8;
const REPLY_PATTERN = /^(approve|reject)\s+([0-9a-hjkmnp-tv-z]{8})$/iu;
const SUBJECT_LIMIT = 160;
const DETAIL_LIMIT = 240;

export const MESSAGE_APPROVAL_TTL_MS = 6 * 60 * 60 * 1000;

export type MessageApprovalResolution = "approved" | "rejected";

export interface MessageApprovalReply {
  resolution: MessageApprovalResolution;
  code: string;
}

export function generateMessageApprovalCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));

  return Array.from(bytes, (byte) => CODE_ALPHABET[byte & 31]).join("");
}

export function parseMessageApprovalReply(body: string): MessageApprovalReply | null {
  const match = REPLY_PATTERN.exec(body.trim());

  if (!match) {
    return null;
  }

  return {
    resolution: match[1].toLowerCase() === "approve" ? "approved" : "rejected",
    code: match[2].toUpperCase(),
  };
}

export function describeMessageApproval(input: {
  subject: string;
  detail?: string;
  code: string;
}): string {
  const detail = input.detail ? toPlainChannelLine(input.detail, DETAIL_LIMIT) : "";

  return [
    `Waiting on you: ${toPlainChannelLine(input.subject, SUBJECT_LIMIT)}`,
    ...(detail ? [detail] : []),
    "",
    `Reply APPROVE ${input.code} to go ahead or REJECT ${input.code} to stop. The code works once and expires in ${MESSAGE_APPROVAL_TTL_MS / (60 * 60 * 1000)} hours.`,
  ].join("\n");
}
