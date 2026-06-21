export const ANALYTICS_EVENT_CATEGORIES = {
	AUTH: "authentication",
	CONVERSATION: "conversation",
	UI_INTERACTION: "ui_interaction",
	FEATURE_USAGE: "feature_usage",
	ERROR: "error",
	USER_JOURNEY: "user_journey",
	NAVIGATION: "navigation",
	SESSION: "session",
} as const;

export type AnalyticsPropertyValue = string | number | boolean | null | undefined;
export type AnalyticsEventProperties = Record<string, AnalyticsPropertyValue>;

export type AnalyticsEvent = {
	name: string;
	category: string;
	label?: string;
	value?: number | string;
	nonInteraction?: boolean;
	properties?: AnalyticsEventProperties;
};

export type AnalyticsIdentity = {
	userId?: string | number | null;
	anonymousUserId?: string | null;
	fallback?: string;
};

export type AnalyticsTrackingPolicyInput = {
	isAuthenticated?: boolean;
	userTrackingEnabled?: boolean | null;
	requireAuthenticatedPreference?: boolean;
};

export function buildAnalyticsDistinctId({
	userId,
	anonymousUserId,
	fallback = "anonymous:server",
}: AnalyticsIdentity): string {
	if (userId !== undefined && userId !== null) {
		return `user:${String(userId)}`;
	}

	if (anonymousUserId) {
		return `anonymous:${anonymousUserId}`;
	}

	return fallback;
}

export function isAnalyticsTrackingEnabled({
	isAuthenticated = false,
	userTrackingEnabled,
	requireAuthenticatedPreference = false,
}: AnalyticsTrackingPolicyInput): boolean {
	if (!isAuthenticated) {
		return true;
	}

	if (userTrackingEnabled === false) {
		return false;
	}

	if (requireAuthenticatedPreference && userTrackingEnabled === undefined) {
		return false;
	}

	return true;
}

export function compactAnalyticsProperties(
	properties: AnalyticsEventProperties | undefined,
): Record<string, string | number | boolean> {
	const output: Record<string, string | number | boolean> = {};
	if (!properties) {
		return output;
	}

	for (const [key, value] of Object.entries(properties)) {
		if (value !== null && value !== undefined) {
			output[key] = value;
		}
	}

	return output;
}

export function stringifyAnalyticsProperties(
	properties: AnalyticsEventProperties | undefined,
): Record<string, string> {
	const output: Record<string, string> = {};
	if (!properties) {
		return output;
	}

	for (const [key, value] of Object.entries(properties)) {
		if (value !== null && value !== undefined) {
			output[key] = String(value);
		}
	}

	return output;
}
