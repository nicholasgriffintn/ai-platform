import { describe, expect, it } from "vitest";

import {
	formatWeatherHour,
	resolveWeatherDailyRangeSegments,
	type WeatherDailyForecast,
} from "./weather";

describe("weather presentation helpers", () => {
	it("formats hourly forecast labels as clock times", () => {
		expect(formatWeatherHour("2026-01-01T01:00:00.000Z")).toBe("01:00");
		expect(formatWeatherHour("2026-01-01T13:00:00.000Z")).toBe("13:00");
	});

	it("scales daily range bars against the forecast temperature span", () => {
		const forecast: WeatherDailyForecast[] = [
			{
				date: "2026-06-30",
				tempMin: 19,
				tempMax: 20,
				description: "clouds",
				precipitationProbability: 0,
			},
			{
				date: "2026-07-01",
				tempMin: 14,
				tempMax: 26,
				description: "clouds",
				precipitationProbability: 0,
			},
			{
				date: "2026-07-02",
				tempMin: 17,
				tempMax: 31,
				description: "clear",
				precipitationProbability: 0,
			},
		];

		expect(resolveWeatherDailyRangeSegments(forecast)).toEqual([
			{ offsetPercent: 29, widthPercent: 6 },
			{ offsetPercent: 0, widthPercent: 71 },
			{ offsetPercent: 18, widthPercent: 82 },
		]);
	});
});
