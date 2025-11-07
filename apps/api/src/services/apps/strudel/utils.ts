import { strudelPatternSchema } from "@assistant/schemas";
import type { z } from "zod";

import type { AppData } from "~/repositories/AppDataRepository";

export type StrudelPattern = z.infer<typeof strudelPatternSchema>;

export const STRUDEL_APP_ID = "strudel";

type StoredPatternPayload = {
	name?: string;
	code?: string;
	description?: string;
	tags?: string[];
};

const parseStoredPayload = (raw: unknown): StoredPatternPayload => {
	if (!raw) {
		return {};
	}

	if (typeof raw === "string") {
		try {
			return JSON.parse(raw);
		} catch {
			return {};
		}
	}

	if (typeof raw === "object") {
		return raw as StoredPatternPayload;
	}

	return {};
};

const sanitizeTags = (tags?: string[]): string[] => {
	if (!Array.isArray(tags)) {
		return [];
	}

	return tags
		.map((tag) => (typeof tag === "string" ? tag.trim() : ""))
		.filter((tag) => tag.length > 0);
};

export const normalizePatternPayload = (
	payload: StoredPatternPayload,
): Required<StoredPatternPayload> => ({
	name:
		typeof payload.name === "string" && payload.name.trim().length > 0
			? payload.name.trim()
			: "Untitled Pattern",
	code: typeof payload.code === "string" ? payload.code.trim() : "",
	description:
		typeof payload.description === "string" &&
		payload.description.trim().length > 0
			? payload.description.trim()
			: "",
	tags: sanitizeTags(payload.tags),
});

export const mapResponseToPattern = (response: AppData): StrudelPattern => {
	const normalized = normalizePatternPayload(parseStoredPayload(response.data));

	return strudelPatternSchema.parse({
		id: response.id,
		name: normalized.name,
		code: normalized.code,
		description: normalized.description || undefined,
		tags: normalized.tags,
		createdAt: response.created_at,
		updatedAt: response.updated_at,
	});
};

export const buildPatternPayload = ({
	name,
	code,
	description,
	tags,
}: {
	name: string;
	code: string;
	description?: string;
	tags?: string[];
}): Required<StoredPatternPayload> => {
	return normalizePatternPayload({
		name,
		code,
		description,
		tags,
	});
};

export const extractStoredPattern = (data: unknown) =>
	normalizePatternPayload(parseStoredPayload(data));
