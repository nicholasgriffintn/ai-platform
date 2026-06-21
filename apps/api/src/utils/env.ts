export function readEnvString(value: string | undefined): string | null {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

export function readBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
	if (value === undefined || value === "") {
		return defaultValue;
	}

	return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}
