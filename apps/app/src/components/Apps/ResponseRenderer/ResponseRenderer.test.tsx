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

	it("renders weather outputs as a forecast card", () => {
		render(
			<ResponseRenderer
				result={{
					status: "success",
					name: "get_weather",
					content: "The current temperature is 11°C with Clear",
					data: {
						cod: 200,
						main: {
							temp: 11,
							feels_like: 10,
							temp_min: 8,
							temp_max: 20,
							pressure: 1013,
							humidity: 94,
						},
						weather: [{ main: "Clear", description: "clear sky", icon: "01d" }],
						wind: { speed: 2.2, deg: 200 },
						clouds: { all: 5 },
						sys: { country: "AU" },
						name: "Perth",
						forecast: {
							hourly: [
								{
									time: "2026-07-01T09:00:00.000Z",
									temp: 11,
									description: "clear sky",
									icon: "01d",
									precipitationProbability: 0,
									humidity: 94,
									windSpeed: 2.2,
								},
								{
									time: "2026-01-01T12:00:00.000Z",
									temp: 18,
									description: "clear sky",
									icon: "01d",
									precipitationProbability: 0,
									humidity: 80,
									windSpeed: 8,
								},
							],
							daily: [
								{
									date: "2026-06-30",
									tempMin: 8,
									tempMax: 20,
									description: "clear sky",
									icon: "01d",
									precipitationProbability: 0,
								},
								{
									date: "2026-07-01",
									tempMin: 11,
									tempMax: 19,
									description: "clear sky",
									icon: "01d",
									precipitationProbability: 0,
								},
							],
						},
					},
				}}
			/>,
		);

		expect(screen.getByRole("region", { name: "Weather forecast for Perth" })).toBeInTheDocument();
		expect(screen.getByText("Perth")).toBeInTheDocument();
		expect(screen.getAllByText("11°C").length).toBeGreaterThan(0);
		expect(screen.getByText("feels like 10°C")).toBeInTheDocument();
		expect(screen.getByText("94%")).toBeInTheDocument();
		expect(screen.getByText("8 km/h")).toBeInTheDocument();
		expect(screen.getByText("12:00")).toBeInTheDocument();
		expect(screen.getByText("Today")).toBeInTheDocument();
		expect(screen.getByText("Wed")).toBeInTheDocument();
		expect(screen.getByLabelText("Wed temperature range").firstElementChild).toHaveStyle({
			marginLeft: "25%",
			width: "67%",
		});
		expect(screen.queryByText(/"cod"/)).not.toBeInTheDocument();
	});
});
