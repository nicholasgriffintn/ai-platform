import { ARTIFICIAL_ANALYSIS_API_BASE_URL, ARTIFICIAL_ANALYSIS_LLM_MODEL_TYPE } from "./constants";

export type ArtificialAnalysisEndpoint = {
	path: string;
	modelType: string;
	label: string;
	paginated?: boolean;
};

export const ARTIFICIAL_ANALYSIS_FREE_MODEL_ENDPOINTS: readonly ArtificialAnalysisEndpoint[] = [
	{
		path: "/api/v2/language/models/free",
		modelType: ARTIFICIAL_ANALYSIS_LLM_MODEL_TYPE,
		label: "Language models",
		paginated: true,
	},
	{
		path: "/api/v2/media/text-to-image/models/free",
		modelType: "text_to_image",
		label: "Text-to-image arena",
	},
	{
		path: "/api/v2/media/image-editing/models/free",
		modelType: "image_editing",
		label: "Image-editing arena",
	},
	{
		path: "/api/v2/media/music/with-vocals/models/free",
		modelType: "music_with_vocals",
		label: "Music with vocals arena",
	},
	{
		path: "/api/v2/media/text-to-speech/models/free",
		modelType: "text_to_speech",
		label: "Text-to-speech arena",
	},
	{
		path: "/api/v2/media/speech-to-speech/models/free",
		modelType: "speech_to_speech",
		label: "Speech-to-speech",
	},
	{
		path: "/api/v2/media/speech-to-text/models/free",
		modelType: "speech_to_text",
		label: "Speech-to-text",
	},
	{
		path: "/api/v2/media/text-to-video/models/free",
		modelType: "text_to_video",
		label: "Text-to-video arena",
	},
	{
		path: "/api/v2/media/image-to-video/models/free",
		modelType: "image_to_video",
		label: "Image-to-video arena",
	},
	{
		path: "/api/v2/media/text-to-video-audio/models/free",
		modelType: "text_to_video_audio",
		label: "Text-to-video with audio arena",
	},
	{
		path: "/api/v2/media/image-to-video-audio/models/free",
		modelType: "image_to_video_audio",
		label: "Image-to-video with audio arena",
	},
];

export function buildArtificialAnalysisEndpointUrl(
	endpoint: ArtificialAnalysisEndpoint,
	page?: number,
): string {
	const url = new URL(endpoint.path, ARTIFICIAL_ANALYSIS_API_BASE_URL);
	if (page !== undefined) {
		url.searchParams.set("page", String(page));
	}
	return url.toString();
}
