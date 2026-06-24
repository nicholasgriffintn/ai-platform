import type { UsageLimits } from "~/state/stores/usageStore";
import type { AnonymousUser, User } from "~/types";

export const NON_AUTH_DAILY_MESSAGE_LIMIT = 10;
export const AUTH_DAILY_MESSAGE_LIMIT = 50;
export const DAILY_LIMIT_PRO_MODELS = 200;

function asFiniteNumber(value: unknown) {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isUsageLimit(value: unknown): value is { used: number; limit: number } {
	if (!value || typeof value !== "object") {
		return false;
	}

	const record = value as Record<string, unknown>;
	return asFiniteNumber(record.used) !== undefined && asFiniteNumber(record.limit) !== undefined;
}

export function normaliseUsageLimits(value: unknown): UsageLimits | null {
	if (!value || typeof value !== "object") {
		return null;
	}

	const record = value as Record<string, unknown>;
	const daily = isUsageLimit(record.daily) ? record.daily : undefined;
	if (!daily) {
		return null;
	}

	const usageLimits: UsageLimits = {
		daily,
	};

	if (isUsageLimit(record.pro)) {
		usageLimits.pro = record.pro;
	}

	const byok = record.byok;
	if (byok && typeof byok === "object") {
		const byokRecord = byok as Record<string, unknown>;
		const used = asFiniteNumber(byokRecord.used);
		if (used !== undefined && byokRecord.limit === null) {
			usageLimits.byok = {
				used,
				limit: null,
			};
		}
	}

	return usageLimits;
}

export function getUsageLimitsFromUser(user: User | null): UsageLimits | null {
	if (!user) {
		return null;
	}

	const usageLimits: UsageLimits = {
		daily: {
			used: user.daily_message_count ?? 0,
			limit: AUTH_DAILY_MESSAGE_LIMIT,
		},
		byok: {
			used: user.daily_byok_message_count ?? 0,
			limit: null,
		},
	};

	if (user.plan_id === "pro") {
		usageLimits.pro = {
			used: user.daily_pro_message_count ?? 0,
			limit: DAILY_LIMIT_PRO_MODELS,
		};
	}

	return usageLimits;
}

export function getUsageLimitsFromAnonymousUser(anonymousUser: AnonymousUser | null) {
	if (!anonymousUser) {
		return null;
	}

	return {
		daily: {
			used: anonymousUser.daily_message_count ?? 0,
			limit: NON_AUTH_DAILY_MESSAGE_LIMIT,
		},
	};
}
