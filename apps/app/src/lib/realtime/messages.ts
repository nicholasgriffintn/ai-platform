interface TranscriptResult {
	isFinal: boolean;
	source: "input" | "output" | "unknown";
	text: string;
}

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

function getTranscriptSource(value: Record<string, unknown>): TranscriptResult["source"] {
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

export function extractRealtimeTranscript(payload: unknown): TranscriptResult | undefined {
	if (!isRecord(payload)) {
		return undefined;
	}

	const serverContent = getNestedRecord(payload, "serverContent");
	const serverTranscript = getTranscriptFromRecord(serverContent);
	if (serverContent && serverTranscript) {
		return {
			text: serverTranscript,
			isFinal: true,
			source: getTranscriptSource(serverContent),
		};
	}

	const directTranscript = getTranscriptFromRecord(payload);
	if (!directTranscript) {
		return undefined;
	}

	const type = getString(payload.type)?.toLowerCase() ?? "";
	return {
		text: directTranscript,
		isFinal:
			type.includes("completed") ||
			type.includes("final") ||
			type.includes("done") ||
			!type.includes("delta"),
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
