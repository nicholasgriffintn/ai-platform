interface SanitiseNameOptions {
	maxLength?: number;
	fallback?: string;
}

export function sanitiseResourceName(name: string, options: SanitiseNameOptions = {}): string {
	const maxLength = options.maxLength ?? 63;
	const sanitised = name
		.replace(/[^A-Za-z0-9-]/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, maxLength);

	return sanitised || options.fallback || "";
}

export function appendResourceNameSuffix(baseName: string, suffix: string, maxLength = 63): string {
	const suffixWithSeparator = `-${suffix}`;
	const prefix = baseName.slice(0, maxLength - suffixWithSeparator.length).replace(/-+$/g, "");

	return `${prefix || "training"}${suffixWithSeparator}`;
}
