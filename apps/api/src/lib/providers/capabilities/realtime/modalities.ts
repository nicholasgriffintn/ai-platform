import { AssistantError, ErrorType } from "~/utils/errors";

export const REALTIME_MODALITIES = ["text", "audio", "image", "video"] as const;
export type RealtimeModality = (typeof REALTIME_MODALITIES)[number];

export const REALTIME_TRANSPORTS = ["webrtc", "websocket"] as const;
export type RealtimeTransport = (typeof REALTIME_TRANSPORTS)[number];

function isRealtimeModality(value: string): value is RealtimeModality {
	return REALTIME_MODALITIES.includes(value as RealtimeModality);
}

export function parseRealtimeModalities(value?: string): RealtimeModality[] | undefined {
	if (!value) {
		return undefined;
	}

	const modalities = value
		.split(",")
		.map((modality) => modality.trim().toLowerCase())
		.filter(Boolean);

	if (modalities.length === 0) {
		return undefined;
	}

	const uniqueModalities = new Set<RealtimeModality>();
	for (const modality of modalities) {
		if (!isRealtimeModality(modality)) {
			throw new AssistantError("Invalid realtime modality specified", ErrorType.PARAMS_ERROR);
		}
		uniqueModalities.add(modality);
	}

	return Array.from(uniqueModalities);
}

export function parseRealtimeTransport(value?: string): RealtimeTransport | undefined {
	if (!value) {
		return undefined;
	}

	const transport = value.trim().toLowerCase();
	if (!REALTIME_TRANSPORTS.includes(transport as RealtimeTransport)) {
		throw new AssistantError("Invalid realtime transport specified", ErrorType.PARAMS_ERROR);
	}

	return transport as RealtimeTransport;
}

export function validateRealtimeModalities({
	requested,
	supported,
	label,
}: {
	requested?: RealtimeModality[];
	supported: readonly RealtimeModality[];
	label: string;
}): void {
	if (!requested) {
		return;
	}

	const unsupported = requested.filter((modality) => !supported.includes(modality));
	if (unsupported.length > 0) {
		throw new AssistantError(`Unsupported ${label} modality specified`, ErrorType.PARAMS_ERROR);
	}
}
