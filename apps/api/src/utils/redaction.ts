import { isPlainObject } from "./objects";

const REDACTED = "[redacted]";

const SENSITIVE_FIELD_NAMES =
	"(?:authorization|api[-_ ]?key|x[-_ ]?api[-_ ]?key|x[-_ ]?goog[-_ ]?api[-_ ]?key|xi[-_ ]?api[-_ ]?key|cf[-_ ]?aig[-_ ]?authorization|token|access[-_ ]?token|refresh[-_ ]?token|secret|secret[-_ ]?key|client[-_ ]?secret)";
const TOKEN_VALUE = "[^\"'\\s,;}&\\]\\[]{4,}";
const MIN_SECRET_TOKEN_LENGTH = 24;
const MIN_SECRET_TOKEN_ENTROPY = 3.5;

const AUTHORIZATION_VALUE_PATTERN = new RegExp(`\\b(Bearer|Token|Key)\\s+(${TOKEN_VALUE})`, "gi");
const QUOTED_FIELD_PATTERN = new RegExp(
	`((?:"|')?${SENSITIVE_FIELD_NAMES}(?:"|')?\\s*[:=]\\s*(?:"|'))([^"']{4,})((?:"|'))`,
	"gi",
);
const UNQUOTED_FIELD_PATTERN = new RegExp(
	`(\\b${SENSITIVE_FIELD_NAMES}\\b\\s*[:=]\\s*)((?:Bearer|Token|Key)\\s+)?(${TOKEN_VALUE})`,
	"gi",
);
const LIKELY_SECRET_TOKEN_PATTERN = /\b[A-Za-z0-9._~+=/-]{24,}\b/g;
const SENSITIVE_OBJECT_KEY_PATTERN = new RegExp(`^${SENSITIVE_FIELD_NAMES}$`, "i");

function calculateEntropy(value: string): number {
	const counts = new Map<string, number>();
	for (const char of value) {
		counts.set(char, (counts.get(char) ?? 0) + 1);
	}

	return Array.from(counts.values()).reduce((entropy, count) => {
		const probability = count / value.length;
		return entropy - probability * Math.log2(probability);
	}, 0);
}

function getCharacterClassCount(value: string): number {
	return [
		/[a-z]/.test(value),
		/[A-Z]/.test(value),
		/\d/.test(value),
		/[^A-Za-z0-9]/.test(value),
	].filter(Boolean).length;
}

function isLikelySecretToken(value: string): boolean {
	return (
		value.length >= MIN_SECRET_TOKEN_LENGTH &&
		/[A-Za-z]/.test(value) &&
		/\d/.test(value) &&
		getCharacterClassCount(value) >= 3 &&
		calculateEntropy(value) >= MIN_SECRET_TOKEN_ENTROPY
	);
}

function redactString(value: string): string {
	return value
		.replace(QUOTED_FIELD_PATTERN, `$1${REDACTED}$3`)
		.replace(UNQUOTED_FIELD_PATTERN, `$1${REDACTED}`)
		.replace(AUTHORIZATION_VALUE_PATTERN, `$1 ${REDACTED}`)
		.replace(LIKELY_SECRET_TOKEN_PATTERN, (token) =>
			isLikelySecretToken(token) ? REDACTED : token,
		);
}

function redactValue(value: unknown, seen: WeakSet<object>): unknown {
	if (typeof value === "string") {
		return redactString(value);
	}

	if (!value || typeof value !== "object") {
		return value;
	}

	if (seen.has(value)) {
		return REDACTED;
	}

	if (Array.isArray(value)) {
		seen.add(value);
		const redacted = value.map((item) => redactValue(item, seen));
		seen.delete(value);
		return redacted;
	}

	if (!isPlainObject(value)) {
		return value;
	}

	seen.add(value);
	const redacted: Record<string, unknown> = {};
	for (const [key, item] of Object.entries(value)) {
		redacted[key] = SENSITIVE_OBJECT_KEY_PATTERN.test(key) ? REDACTED : redactValue(item, seen);
	}
	seen.delete(value);
	return redacted;
}

export function redactSensitiveTokens<T>(value: T): T {
	return redactValue(value, new WeakSet<object>()) as T;
}
