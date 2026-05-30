import { trainingProviderSchema } from "@assistant/schemas";

export function decodeTrainingProvider(value: string) {
	return trainingProviderSchema.parse(decodeURIComponent(value));
}

export function decodeRouteSegment(value: string): string {
	return decodeURIComponent(value);
}

export function parseOptionalPositiveInteger(value: string | null): number | undefined {
	if (!value) return undefined;

	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}
