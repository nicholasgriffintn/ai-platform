const mimeTypeExtensions: Record<string, string> = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/webp": "webp",
	"audio/wav": "wav",
	"audio/wave": "wav",
	"audio/mpeg": "mp3",
	"audio/mp3": "mp3",
	"audio/ogg": "ogg",
	"audio/opus": "opus",
	"audio/flac": "flac",
	"audio/pcm": "pcm",
	"audio/l16": "pcm",
};

export function getExtensionFromMimeType(mimeType: string, fallback: string): string {
	const normalized = mimeType.split(";")[0]?.toLowerCase() || "";
	return mimeTypeExtensions[normalized] || fallback;
}
