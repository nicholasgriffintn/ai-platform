import { AssistantError, ErrorType } from "~/utils/errors";

const E164_PATTERN = /^\+[1-9]\d{6,14}$/;
const SENDER_SEPARATOR_PATTERN = /[,;\n]+/;

export function normaliseMessagingAddress(value: string): string {
  const compact = value
    .trim()
    .toLowerCase()
    .replace(/[()\-.\s]/g, "");

  return compact.startsWith("00") ? `+${compact.slice(2)}` : compact;
}

export function parseAllowedSenders(value: string | undefined): string[] {
  const entries = (value ?? "")
    .split(SENDER_SEPARATOR_PATTERN)
    .map(normaliseMessagingAddress)
    .filter(Boolean);
  const allowedSenders = Array.from(new Set(entries));

  for (const sender of allowedSenders) {
    if (!E164_PATTERN.test(sender)) {
      throw new AssistantError(
        `Allowed sender "${sender}" must be an E.164 phone number, for example +15551234567`,
        ErrorType.PARAMS_ERROR,
      );
    }
  }

  if (allowedSenders.length === 0) {
    throw new AssistantError(
      "Messaging providers require at least one allowed sender phone number",
      ErrorType.PARAMS_ERROR,
    );
  }

  return allowedSenders;
}

export function readAllowedSenders(credentials: { allowedSenders?: unknown }): string[] {
  return Array.isArray(credentials.allowedSenders)
    ? credentials.allowedSenders.filter((sender): sender is string => typeof sender === "string")
    : [];
}

export function isAuthorisedSender(allowedSenders: readonly string[], from: string): boolean {
  const sender = normaliseMessagingAddress(from);

  return sender.length > 0 && allowedSenders.includes(sender);
}
