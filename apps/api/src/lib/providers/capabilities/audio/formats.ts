import { AssistantError, ErrorType } from "~/utils/errors";

export const audioResponseFormats = ["mp3", "wav", "pcm", "flac", "opus"] as const;

export type AudioResponseFormat = (typeof audioResponseFormats)[number];

export const defaultAudioResponseFormat: AudioResponseFormat = "mp3";

const audioFormatMetadata: Record<
	AudioResponseFormat,
	{
		extension: string;
		mimeType: string;
	}
> = {
	mp3: { extension: "mp3", mimeType: "audio/mpeg" },
	wav: { extension: "wav", mimeType: "audio/wav" },
	pcm: { extension: "pcm", mimeType: "audio/pcm" },
	flac: { extension: "flac", mimeType: "audio/flac" },
	opus: { extension: "opus", mimeType: "audio/opus" },
};

export function resolveAudioResponseFormat(format?: string): AudioResponseFormat {
	if (!format) {
		return defaultAudioResponseFormat;
	}

	if (isAudioResponseFormat(format)) {
		return format;
	}

	throw new AssistantError(`Unsupported audio response format: ${format}`, ErrorType.PARAMS_ERROR);
}

export function getAudioFormatMetadata(format: AudioResponseFormat) {
	return audioFormatMetadata[format];
}

function isAudioResponseFormat(format: string): format is AudioResponseFormat {
	return audioResponseFormats.some((supportedFormat) => supportedFormat === format);
}
