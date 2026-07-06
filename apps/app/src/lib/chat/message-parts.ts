import { normaliseMessageParts as normaliseSchemaMessageParts } from "@assistant/schemas/message-part-utils";
import type { Message } from "~/types";

export function normaliseMessageParts(parts: unknown): Message["parts"] | undefined {
	return normaliseSchemaMessageParts(parts);
}
