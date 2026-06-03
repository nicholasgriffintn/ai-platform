import { describe, expect, it } from "vitest";

import {
	resolveGeneratedAudioResponseData,
	resolveGeneratedImageResponseData,
	resolveResponseData,
	resolveTextResponseData,
} from "./response-data";

describe("ResponseRenderer response data", () => {
	it("uses tool message content for text responses when metadata has no content", () => {
		const result = {
			status: "error",
			name: "run_feature_implementation",
			content: "User context is required for sandbox execution",
			data: {
				responseType: "text",
				responseDisplay: {
					fields: [
						{ key: "status", label: "Status" },
						{ key: "content", label: "Error" },
					],
				},
				icon: "alert-triangle",
				formattedName: "Run Feature Implementation",
			},
		};

		const responseData = resolveResponseData(result, {
			hasAppSchema: false,
			responseType: "text",
		});

		expect(resolveTextResponseData(result, responseData)).toEqual({
			content: "User context is required for sandbox execution",
		});
	});

	it("keeps explicit text response content from response data", () => {
		const result = {
			content: "fallback",
			data: {
				content: "preferred",
			},
		};

		expect(
			resolveTextResponseData(
				result,
				resolveResponseData(result, {
					hasAppSchema: false,
					responseType: "text",
				}),
			),
		).toEqual({ content: "preferred" });
	});

	it("does not unwrap result without an app schema or response type", () => {
		const result = {
			data: {
				result: {
					content: "nested",
				},
			},
		};

		expect(resolveResponseData(result, { hasAppSchema: false })).toEqual(result.data);
	});

	it("resolves screenshot output from the generated screenshot url instead of the input url", () => {
		const responseData = {
			name: "capture_screenshot",
			content: "Screenshot captured: [View Screenshot](http://localhost:8787/assets/asset-123)",
			data: {
				url: "https://google.com",
				screenshotUrl: "http://localhost:8787/assets/asset-123",
			},
		};

		expect(resolveGeneratedImageResponseData(responseData)).toEqual({
			title: "Captured Screenshot",
			content: "Screenshot captured.",
			imageUrl: "http://localhost:8787/assets/asset-123",
		});
	});

	it("does not treat screenshot input urls as generated images", () => {
		const responseData = {
			name: "capture_screenshot",
			content: "Screenshot captured.",
			data: {
				url: "https://google.com",
			},
		};

		expect(resolveGeneratedImageResponseData(responseData)).toBeNull();
	});

	it("resolves generated images from image attachments before direct urls", () => {
		const responseData = {
			name: "create_image",
			content: "Image generated successfully",
			data: {
				url: "https://example.com/fallback.png",
				attachments: [
					{
						type: "image",
						url: "http://localhost:8787/assets/asset-456",
					},
				],
			},
		};

		expect(resolveGeneratedImageResponseData(responseData)).toEqual({
			title: "Generated Image",
			content: "Image generated successfully",
			imageUrl: "http://localhost:8787/assets/asset-456",
		});
	});

	it("resolves generated audio from response audio urls before raw provider urls", () => {
		const responseData = {
			model: "elevenlabs/music",
			content: "Music generated successfully",
			data: {
				url: "https://replicate.delivery/example/generated.mp3",
				response: [
					{
						type: "audio_url",
						audio_url: {
							url: "http://localhost:8787/assets/audio-asset-123",
						},
					},
				],
			},
		};

		expect(resolveGeneratedAudioResponseData(responseData)).toEqual({
			title: "Generated Music",
			content: "Music generated successfully",
			audioUrl: "http://localhost:8787/assets/audio-asset-123",
		});
	});

	it("resolves generated audio from raw response audio urls before raw provider urls", () => {
		const responseData = {
			model: "elevenlabs/music",
			content: "Music generated successfully",
			data: {
				url: "https://replicate.delivery/example/generated.mp3",
				raw: {
					model: "elevenlabs/music",
					output: "https://replicate.delivery/example/generated.mp3",
					response: [
						{
							type: "audio_url",
							audio_url: {
								url: "http://localhost:8787/assets/audio-asset-456",
							},
						},
					],
				},
			},
		};

		expect(resolveGeneratedAudioResponseData(responseData)).toEqual({
			title: "Generated Music",
			content: "Music generated successfully",
			audioUrl: "http://localhost:8787/assets/audio-asset-456",
		});
	});
});
