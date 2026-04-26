import type { CavemanLevel } from "~/types";

export const CAVEMAN_DEFAULT_LEVEL: CavemanLevel = "full";

const CAVEMAN_LEVEL_SET = new Set<CavemanLevel>([
	"lite",
	"full",
	"ultra",
	"wenyan-lite",
	"wenyan-full",
	"wenyan-ultra",
]);

export type CavemanCommand =
	| { type: "none" }
	| { type: "disable" }
	| { type: "enable"; level: CavemanLevel };

export function parseCavemanCommand(input: string): CavemanCommand {
	const normalized = input.trim().toLowerCase();
	if (!normalized) {
		return { type: "none" };
	}

	if (normalized === "stop caveman" || normalized === "normal mode") {
		return { type: "disable" };
	}

	if (!normalized.startsWith("/caveman")) {
		return { type: "none" };
	}

	const [, requestedLevel] = normalized.split(/\s+/, 2);
	if (!requestedLevel) {
		return { type: "enable", level: CAVEMAN_DEFAULT_LEVEL };
	}

	if (!CAVEMAN_LEVEL_SET.has(requestedLevel as CavemanLevel)) {
		return { type: "none" };
	}

	return { type: "enable", level: requestedLevel as CavemanLevel };
}
