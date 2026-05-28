export interface RealtimeTranscriptResult {
	isDelta: boolean;
	isFinal: boolean;
	itemId?: string;
	responseId?: string;
	source: "input" | "output" | "unknown";
	text: string;
}

export interface RealtimeEventResult {
	itemId?: string;
	label?: string;
	responseId?: string;
	type: string;
}

const REALTIME_EVENT_LABELS: Record<string, string> = {
	"session.created": "Realtime session ready",
	"session.updated": "Realtime session configured",
	"input_audio_buffer.speech_started": "Listening",
	"input_audio_buffer.speech_stopped": "Processing speech",
	"input_audio_buffer.committed": "Speech captured",
	"response.created": "Assistant responding",
	"response.output_item.added": "Assistant responding",
	"response.content_part.added": "Assistant responding",
	"response.output_audio.delta": "Assistant speaking",
	"response.output_audio.done": "Assistant audio complete",
	"response.done": "Assistant response complete",
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function getString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function getNestedRecord(value: unknown, key: string): Record<string, unknown> | undefined {
	if (!isRecord(value)) {
		return undefined;
	}

	const nested = value[key];
	return isRecord(nested) ? nested : undefined;
}

function getTranscriptFromRecord(value: unknown): string | undefined {
	if (!isRecord(value)) {
		return undefined;
	}

	return (
		getString(value.text) ??
		getString(value.transcript) ??
		getString(value.delta) ??
		getString(getNestedRecord(value, "inputTranscription")?.text) ??
		getString(getNestedRecord(value, "outputTranscription")?.text) ??
		getString(getNestedRecord(value, "input_transcription")?.text) ??
		getString(getNestedRecord(value, "output_transcription")?.text)
	);
}

function getRealtimeItemId(value: Record<string, unknown>): string | undefined {
	return getString(value.item_id) ?? getString(value.itemId);
}

function getRealtimeResponseId(value: Record<string, unknown>): string | undefined {
	const response = getNestedRecord(value, "response");
	return getString(value.response_id) ?? getString(value.responseId) ?? getString(response?.id);
}

function getTextFromParts(parts: unknown): string | undefined {
	if (!Array.isArray(parts)) {
		return undefined;
	}

	const text = parts
		.map((part) => (isRecord(part) ? getString(part.text) : undefined))
		.filter((partText): partText is string => Boolean(partText))
		.join("");

	return text.length > 0 ? text : undefined;
}

function getTranscriptSource(value: Record<string, unknown>): RealtimeTranscriptResult["source"] {
	const type = getString(value.type)?.toLowerCase() ?? "";
	if (type.includes("input")) {
		return "input";
	}
	if (type.includes("output") || type.includes("response")) {
		return "output";
	}
	if (
		getNestedRecord(value, "inputTranscription") ||
		getNestedRecord(value, "input_transcription")
	) {
		return "input";
	}
	if (
		getNestedRecord(value, "outputTranscription") ||
		getNestedRecord(value, "output_transcription")
	) {
		return "output";
	}

	return "unknown";
}

export function parseRealtimeJsonMessage(data: unknown): unknown | undefined {
	if (typeof data !== "string") {
		return undefined;
	}

	try {
		return JSON.parse(data);
	} catch {
		return undefined;
	}
}

export function extractRealtimeErrorMessage(payload: unknown): string | undefined {
	if (!isRecord(payload)) {
		return undefined;
	}

	const type = getString(payload.type)?.toLowerCase() ?? "";
	const error = getNestedRecord(payload, "error");
	if (error) {
		return (
			getString(error.message) ??
			getString(error.code) ??
			getString(error.type) ??
			"Realtime session error"
		);
	}

	if (type.includes("error")) {
		return (
			getString(payload.message) ??
			getString(payload.code) ??
			getString(payload.type) ??
			"Realtime session error"
		);
	}

	return undefined;
}

export function extractRealtimeEventLabel(payload: unknown): string | undefined {
	if (!isRecord(payload)) {
		return undefined;
	}

	const type = extractRealtimeEventType(payload);
	if (!type || type.includes("transcript")) {
		return undefined;
	}

	return REALTIME_EVENT_LABELS[type];
}

export function extractRealtimeEvent(payload: unknown): RealtimeEventResult | undefined {
	if (!isRecord(payload)) {
		return undefined;
	}

	const type = extractRealtimeEventType(payload);
	if (!type) {
		return undefined;
	}

	const itemId = getRealtimeItemId(payload);
	const responseId = getRealtimeResponseId(payload);
	return {
		...(itemId ? { itemId } : {}),
		label: extractRealtimeEventLabel(payload),
		...(responseId ? { responseId } : {}),
		type,
	};
}

export function extractRealtimeEventType(payload: unknown): string | undefined {
	if (!isRecord(payload)) {
		return undefined;
	}

	return getString(payload.type);
}

export function extractRealtimeTranscript(payload: unknown): RealtimeTranscriptResult | undefined {
	if (!isRecord(payload)) {
		return undefined;
	}

	const serverContent = getNestedRecord(payload, "serverContent");
	const modelTurn =
		getNestedRecord(serverContent, "modelTurn") ?? getNestedRecord(serverContent, "model_turn");
	const serverTranscript =
		getTranscriptFromRecord(serverContent) ?? getTextFromParts(modelTurn?.parts);
	if (serverContent && serverTranscript) {
		const itemId = getRealtimeItemId(payload);
		const responseId = getRealtimeResponseId(payload);
		return {
			text: serverTranscript,
			isDelta: false,
			isFinal: true,
			...(itemId ? { itemId } : {}),
			...(responseId ? { responseId } : {}),
			source: modelTurn ? "output" : getTranscriptSource(serverContent),
		};
	}

	const directTranscript = getTranscriptFromRecord(payload);
	if (!directTranscript) {
		return undefined;
	}

	const type = getString(payload.type)?.toLowerCase() ?? "";
	const itemId = getRealtimeItemId(payload);
	const responseId = getRealtimeResponseId(payload);
	return {
		text: directTranscript,
		isDelta: type.includes("delta"),
		isFinal:
			type.includes("completed") ||
			type.includes("final") ||
			type.includes("done") ||
			!type.includes("delta"),
		...(itemId ? { itemId } : {}),
		...(responseId ? { responseId } : {}),
		source: getTranscriptSource(payload),
	};
}

export function extractGeminiAudioChunks(payload: unknown): string[] {
	if (!isRecord(payload)) {
		return [];
	}

	const serverContent = getNestedRecord(payload, "serverContent");
	const modelTurn = getNestedRecord(serverContent, "modelTurn");
	const parts = Array.isArray(modelTurn?.parts) ? modelTurn.parts : [];
	const chunks: string[] = [];

	for (const part of parts) {
		const inlineData = getNestedRecord(part, "inlineData") ?? getNestedRecord(part, "inline_data");
		const mimeType = getString(inlineData?.mimeType) ?? getString(inlineData?.mime_type);
		const data = getString(inlineData?.data);
		if (data && mimeType?.startsWith("audio/")) {
			chunks.push(data);
		}
	}

	return chunks;
}

export function isGeminiSetupCompleteMessage(payload: unknown): boolean {
	if (!isRecord(payload)) {
		return false;
	}

	return isRecord(payload.setupComplete) || isRecord(payload.setup_complete);
}
