import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ResponseRenderer } from ".";

describe("ResponseRenderer", () => {
	it("renders screenshot outputs with the generated asset image", () => {
		render(
			<ResponseRenderer
				result={{
					status: "success",
					name: "capture_screenshot",
					content: "Screenshot captured: [View Screenshot](http://localhost:8787/assets/asset-123)",
					data: {
						url: "https://google.com",
						screenshotUrl: "http://localhost:8787/assets/asset-123",
					},
				}}
				responseType="template"
				responseDisplay={{
					template: '<img src="{{data.url}}" alt="Generated image">',
				}}
			/>,
		);

		const image = screen.getByAltText("Captured Screenshot");

		expect(screen.getByText("Screenshot captured.")).toBeInTheDocument();
		expect(image).toHaveAttribute("src", "http://localhost:8787/assets/asset-123");
		expect(image).toHaveAttribute("crossorigin", "use-credentials");
		expect(screen.queryByAltText("Generated image")).not.toBeInTheDocument();
	});

	it("renders generated music outputs with the stored asset audio player", () => {
		render(
			<ResponseRenderer
				result={{
					status: "success",
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
				}}
				responseType="template"
				responseDisplay={{
					template: "{{data.url}}",
				}}
			/>,
		);

		const audio = document.querySelector("audio");
		const source = document.querySelector("audio source");

		expect(screen.getByText("Generated Music")).toBeInTheDocument();
		expect(screen.getByText("Music generated successfully")).toBeInTheDocument();
		expect(audio).toHaveAttribute("crossorigin", "use-credentials");
		expect(source).toHaveAttribute("src", "http://localhost:8787/assets/audio-asset-123");
		expect(
			screen.queryByText("https://replicate.delivery/example/generated.mp3"),
		).not.toBeInTheDocument();
	});

	it("renders generated music outputs as audio when response type is missing", () => {
		render(
			<ResponseRenderer
				result={{
					status: "success",
					model: "elevenlabs/music",
					content: "Music generated successfully",
					data: {
						url: "https://replicate.delivery/example/generated.mp3",
						metadata: {
							url: "https://replicate.delivery/example/generated.mp3",
						},
						raw: {
							model: "elevenlabs/music",
							output: "https://replicate.delivery/example/generated.mp3",
							response: [
								{
									type: "audio_url",
									audio_url: {
										url: "http://localhost:8787/assets/audio-asset-123",
									},
								},
							],
						},
					},
				}}
			/>,
		);

		const source = document.querySelector("audio source");

		expect(screen.getByText("Generated Music")).toBeInTheDocument();
		expect(source).toHaveAttribute("src", "http://localhost:8787/assets/audio-asset-123");
		expect(screen.queryByText(/Object/)).not.toBeInTheDocument();
	});
});
