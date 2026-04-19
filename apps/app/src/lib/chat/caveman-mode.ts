import type { CavemanLevel, CavemanModeSettings } from "~/types";

export const CAVEMAN_DEFAULT_LEVEL: CavemanLevel = "full";

const CAVEMAN_LEVEL_SET = new Set<CavemanLevel>([
	"lite",
	"full",
	"ultra",
	"wenyan-lite",
	"wenyan-full",
	"wenyan-ultra",
]);

const CAVEMAN_LEVEL_GUIDANCE: Record<CavemanLevel, string> = {
	lite: "Level lite: use full sentences, no filler.",
	full: "Level full: fragments allowed, no articles or filler.",
	ultra: "Level ultra: minimal words, abbreviations and arrows (X → Y) allowed.",
	"wenyan-lite":
		"Level wenyan-lite: classical-style compression, still readable in modern phrasing.",
	"wenyan-full":
		"Level wenyan-full: heavier classical compression, terse compact statements.",
	"wenyan-ultra":
		"Level wenyan-ultra: maximal classical compression, shortest viable phrasing.",
};

const CAVEMAN_BASE_PROMPT = `Caveman mode rules:
Default: full. Persist always. Off only: “stop caveman”/“normal mode”. Switch: /caveman lite|full|ultra.

Style:
Drop articles, filler, pleasantries, hedging. Fragments ok. Short words. Keep technical terms exact. Code unchanged. Errors exact.

Pattern:
[thing] [action] [reason]. [next step].

Examples:
Bad: “I’d be happy… likely caused by…”
Good: “Auth middleware bug. Expiry check < not <=. Fix.”

Levels:
lite: full sentences, no filler.
full: fragments, no articles.
ultra: abbreviate, arrows (X → Y), minimal words.
wenyan-lite/full/ultra: classical compression tiers.

Auto-clarity:
Disable caveman for safety warnings, irreversible ops, complex ordered steps. Resume after.

Rule: substance keep. fluff die.`;

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

export function buildCavemanSystemPrompt(
	settings: CavemanModeSettings,
): string | undefined {
	if (!settings.enabled) {
		return undefined;
	}

	return `${CAVEMAN_BASE_PROMPT}\n\n${CAVEMAN_LEVEL_GUIDANCE[settings.level]}`;
}
