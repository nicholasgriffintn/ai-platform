import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getWeatherForLocation } from "../weather";

vi.mock("~/utils/errors", () => ({
	AssistantError: class extends Error {
		type: string;
		constructor(message: string, type?: string) {
			super(message);
			this.type = type || "UNKNOWN";
		}
	},
	ErrorType: {
		PARAMS_ERROR: "PARAMS_ERROR",
	},
}));

global.fetch = vi.fn();

describe("getWeatherForLocation", () => {
	const mockEnv = {
		OPENWEATHERMAP_API_KEY: "test-api-key",
	} as any;

	const mockLocation = {
		latitude: 40.7128,
		longitude: -74.006,
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	it("should successfully fetch weather data", async () => {
		const mockWeatherData = {
			cod: 200,
			main: {
				temp: 22.5,
				feels_like: 23.1,
				temp_min: 20.0,
				temp_max: 25.0,
				pressure: 1013,
				humidity: 65,
			},
			weather: [
				{
					id: 800,
					main: "Clear",
					description: "clear sky",
					icon: "01d",
				},
			],
			name: "New York",
		};

		vi.mocked(fetch)
			.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockWeatherData),
			} as Response)
			.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						cod: "200",
						list: [
							{
								dt: 1_782_896_400,
								main: {
									temp: 23,
									temp_min: 21,
									temp_max: 24,
									humidity: 68,
								},
								weather: [{ main: "Clear", description: "clear sky", icon: "01d" }],
								wind: { speed: 4.2 },
								pop: 0.12,
							},
							{
								dt: 1_782_982_800,
								main: {
									temp: 20,
									temp_min: 18,
									temp_max: 22,
									humidity: 82,
								},
								weather: [{ main: "Rain", description: "light rain", icon: "10d" }],
								wind: { speed: 6.1 },
								pop: 0.84,
							},
						],
					}),
			} as Response);

		const result = await getWeatherForLocation(mockEnv, mockLocation);

		expect(result).toEqual({
			status: "success",
			name: "get_weather",
			content: "The current temperature is 22.5°C with Clear",
			data: {
				...mockWeatherData,
				forecast: {
					hourly: [
						{
							description: "clear sky",
							humidity: 68,
							icon: "01d",
							precipitationProbability: 12,
							temp: 23,
							time: "2026-07-01T09:00:00.000Z",
							windSpeed: 4.2,
						},
						{
							description: "light rain",
							humidity: 82,
							icon: "10d",
							precipitationProbability: 84,
							temp: 20,
							time: "2026-07-02T09:00:00.000Z",
							windSpeed: 6.1,
						},
					],
					daily: [
						{
							date: "2026-07-01",
							description: "clear sky",
							icon: "01d",
							precipitationProbability: 12,
							tempMax: 24,
							tempMin: 21,
						},
						{
							date: "2026-07-02",
							description: "light rain",
							icon: "10d",
							precipitationProbability: 84,
							tempMax: 22,
							tempMin: 18,
						},
					],
				},
			},
		});

		expect(fetch).toHaveBeenNthCalledWith(
			1,
			`https://api.openweathermap.org/data/2.5/weather?lat=40.7128&lon=-74.006&units=metric&appid=test-api-key`,
		);
		expect(fetch).toHaveBeenNthCalledWith(
			2,
			`https://api.openweathermap.org/data/2.5/forecast?lat=40.7128&lon=-74.006&units=metric&appid=test-api-key`,
		);
	});

	it("should throw error for missing API key", async () => {
		const envWithoutKey = {};

		await expect(getWeatherForLocation(envWithoutKey, mockLocation)).rejects.toThrow(
			"Error fetching weather results",
		);
	});

	it("should handle API response with non-200 status", async () => {
		vi.mocked(fetch).mockResolvedValue({
			ok: false,
			status: 404,
		} as Response);

		const result = await getWeatherForLocation(mockEnv, mockLocation);

		expect(result).toEqual({
			status: "error",
			name: "get_weather",
			content: "Error fetching weather results",
			data: {},
		});
	});

	it("should handle weather API error response", async () => {
		const errorWeatherData = {
			cod: 404,
			message: "city not found",
		};

		vi.mocked(fetch).mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(errorWeatherData),
		} as Response);

		const result = await getWeatherForLocation(mockEnv, mockLocation);

		expect(result).toEqual({
			status: "error",
			name: "get_weather",
			content: "Sorry, I couldn't find the weather for that location",
			data: {},
		});
	});

	it("should handle different weather conditions", async () => {
		const rainyWeatherData = {
			cod: 200,
			main: {
				temp: 18.3,
			},
			weather: [
				{
					main: "Rain",
					description: "light rain",
				},
			],
		};

		vi.mocked(fetch).mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(rainyWeatherData),
		} as Response);

		const result = await getWeatherForLocation(mockEnv, mockLocation);

		expect(result).toEqual({
			status: "success",
			name: "get_weather",
			content: "The current temperature is 18.3°C with Rain",
			data: rainyWeatherData,
		});
	});

	it("should handle network errors", async () => {
		vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

		await expect(getWeatherForLocation(mockEnv, mockLocation)).rejects.toThrow(
			"Error fetching weather results",
		);
	});

	it("should handle invalid JSON response", async () => {
		// @ts-ignore - fetch is mocked
		vi.mocked(fetch).mockResolvedValue({
			ok: true,
			json: () => Promise.reject(new Error("Invalid JSON")),
		} as Response);

		await expect(getWeatherForLocation(mockEnv, mockLocation)).rejects.toThrow(
			"Error fetching weather results",
		);
	});

	it("should construct correct API URL with coordinates", async () => {
		const customLocation = {
			latitude: 51.5074,
			longitude: -0.1278,
		};

		const mockWeatherData = {
			cod: 200,
			main: { temp: 15.0 },
			weather: [{ main: "Cloudy" }],
		};

		vi.mocked(fetch).mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(mockWeatherData),
		} as Response);

		await getWeatherForLocation(mockEnv, customLocation);

		expect(fetch).toHaveBeenCalledWith(
			`https://api.openweathermap.org/data/2.5/weather?lat=51.5074&lon=-0.1278&units=metric&appid=test-api-key`,
		);
	});

	it("should handle negative coordinates", async () => {
		const southernLocation = {
			latitude: -33.8688,
			longitude: 151.2093,
		};

		const mockWeatherData = {
			cod: 200,
			main: { temp: 25.0 },
			weather: [{ main: "Sunny" }],
		};

		vi.mocked(fetch).mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(mockWeatherData),
		} as Response);

		const result = await getWeatherForLocation(mockEnv, southernLocation);

		expect(result.status).toBe("success");
		expect(fetch).toHaveBeenCalledWith(expect.stringContaining("lat=-33.8688&lon=151.2093"));
	});
});
