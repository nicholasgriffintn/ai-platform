import { fineTuningProviderSchema } from "@assistant/schemas";

export function decodeTrainingProvider(value: string) {
	return fineTuningProviderSchema.parse(decodeURIComponent(value));
}

export function decodeRouteSegment(value: string): string {
	return decodeURIComponent(value);
}
