import { normaliseMessageParts as normaliseSchemaMessageParts } from "@assistant/schemas";
import type { Message } from "~/types";

export function normaliseMessageParts(parts: unknown): Message["parts"] | undefined {
	return normaliseSchemaMessageParts(parts);
}
