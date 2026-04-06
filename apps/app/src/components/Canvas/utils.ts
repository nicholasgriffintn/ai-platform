import type { CanvasMode, CanvasModel } from "~/types/canvas";

interface MediaPreview {
	url: string;
	type: "image" | "video" | "audio" | "unknown";
}

const imageMixedAspectClasses = [
	"aspect-square",
	"aspect-[4/5]",
	"aspect-[3/4]",
	"aspect-[4/3]",
	"aspect-[16/9]",
	"aspect-[5/4]",
	"aspect-[3/2]",
	"aspect-[2/3]",
] as const;

const videoMixedAspectClasses = [
	"aspect-[16/9]",
	"aspect-[9/16]",
	"aspect-[4/3]",
	"aspect-[3/4]",
] as const;

const placeholderPaletteClasses = [
	"from-sky-200 via-cyan-100 to-indigo-200",
	"from-rose-200 via-pink-100 to-orange-200",
	"from-amber-200 via-yellow-100 to-lime-200",
	"from-violet-200 via-purple-100 to-fuchsia-200",
	"from-emerald-200 via-teal-100 to-cyan-200",
	"from-blue-200 via-indigo-100 to-violet-200",
] as const;

function intersectOptions(optionGroups: string[][]): string[] {
	if (!optionGroups.length) {
		return [];
	}

	return optionGroups.reduce((acc, group) =>
		acc.filter((option) => group.includes(option)),
	);
}

export function parseReferenceImages(value: string): string[] {
	return value
		.split(/\n|,/)
		.map((entry) => entry.trim())
		.filter(Boolean);
}

export function collectFieldEnumOptions(
	models: CanvasModel[],
	fieldName: string,
): string[] {
	const optionGroups = models
		.map(
			(model) =>
				model.inputSchema?.fields.find((field) => field.name === fieldName)
					?.enum,
		)
		.filter(
			(enumValues): enumValues is Array<string | number> =>
				Array.isArray(enumValues) && enumValues.length > 0,
		)
		.map((enumValues) =>
			enumValues
				.filter((value): value is string => typeof value === "string")
				.filter(Boolean),
		)
		.filter((options) => options.length > 0);

	if (!optionGroups.length) {
		return [];
	}

	const options =
		optionGroups.length === 1
			? optionGroups[0]
			: intersectOptions(optionGroups);

	return Array.from(new Set(options));
}

function inferMediaType(url: string): MediaPreview["type"] {
	if (/\.(jpg|jpeg|png|gif|webp)$/i.test(url)) {
		return "image";
	}

	if (/\.(mp4|webm|mov)$/i.test(url)) {
		return "video";
	}

	if (/\.(mp3|wav|ogg)$/i.test(url)) {
		return "audio";
	}

	return "unknown";
}

export function getMediaPreview(output: unknown): MediaPreview | null {
	if (!output) {
		return null;
	}

	if (typeof output === "string") {
		return { url: output, type: inferMediaType(output) };
	}

	if (Array.isArray(output)) {
		for (const item of output) {
			if (typeof item === "string") {
				return { url: item, type: inferMediaType(item) };
			}

			if (!item || typeof item !== "object") {
				continue;
			}

			if ("type" in item && item.type === "image_url" && item.image_url?.url) {
				return { url: item.image_url.url, type: "image" };
			}

			if ("type" in item && item.type === "video_url" && item.video_url?.url) {
				return { url: item.video_url.url, type: "video" };
			}

			if ("type" in item && item.type === "audio_url" && item.audio_url?.url) {
				return { url: item.audio_url.url, type: "audio" };
			}

			const nestedUrl =
				(item as Record<string, unknown>).url ||
				(item as Record<string, unknown>).uri;
			if (typeof nestedUrl === "string") {
				return { url: nestedUrl, type: inferMediaType(nestedUrl) };
			}
		}
	}

	if (typeof output === "object") {
		const value = output as Record<string, unknown>;
		const directUrl = value.url || value.uri;
		if (typeof directUrl === "string") {
			return { url: directUrl, type: inferMediaType(directUrl) };
		}
	}

	return null;
}

function mapAspectRatioToClass(aspectRatio?: string): string | null {
	if (!aspectRatio) {
		return null;
	}

	const ratio = aspectRatio.trim().toLowerCase();

	switch (ratio) {
		case "1:1":
			return "aspect-square";
		case "16:9":
		case "landscape":
			return "aspect-[16/9]";
		case "9:16":
		case "portrait":
			return "aspect-[9/16]";
		case "4:3":
			return "aspect-[4/3]";
		case "3:4":
			return "aspect-[3/4]";
		case "3:2":
			return "aspect-[3/2]";
		case "2:3":
			return "aspect-[2/3]";
		case "4:5":
			return "aspect-[4/5]";
		case "5:4":
			return "aspect-[5/4]";
		case "21:9":
			return "aspect-[21/9]";
		default:
			return null;
	}
}

export function getCardAspectClass({
	mode,
	aspectRatio,
	index,
}: {
	mode: CanvasMode;
	aspectRatio?: string;
	index: number;
}): string {
	const selected = mapAspectRatioToClass(aspectRatio);
	if (selected) {
		return selected;
	}

	const mixed =
		mode === "video" ? videoMixedAspectClasses : imageMixedAspectClasses;
	return mixed[index % mixed.length];
}

export function getPlaceholderPaletteClass(index: number): string {
	return placeholderPaletteClasses[index % placeholderPaletteClasses.length];
}
