export interface WeatherData {
	main: {
		temp: number;
		feels_like?: number;
		temp_min?: number;
		temp_max?: number;
		humidity?: number;
	};
	weather?: WeatherCondition[];
	wind?: {
		speed?: number;
	};
	name?: string;
	forecast?: {
		hourly?: WeatherHourlyForecast[];
		daily?: WeatherDailyForecast[];
	};
}

export interface WeatherCondition {
	main?: string;
	description?: string;
	icon?: string;
}

export interface WeatherHourlyForecast {
	time: string;
	temp: number;
	description: string;
	icon?: string;
	precipitationProbability?: number;
	humidity?: number;
	windSpeed?: number;
}

export interface WeatherDailyForecast {
	date: string;
	tempMin: number;
	tempMax: number;
	description: string;
	icon?: string;
	precipitationProbability?: number;
}

export interface WeatherDailyRangeSegment {
	offsetPercent: number;
	widthPercent: number;
}

export function isWeatherData(value: unknown): value is WeatherData {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return false;
	}

	const data = value as { main?: { temp?: unknown } };
	return typeof data.main?.temp === "number";
}

export function hasWeatherMinMax(data: WeatherData): data is WeatherData & {
	main: WeatherData["main"] & { temp_min: number; temp_max: number };
} {
	return typeof data.main.temp_min === "number" && typeof data.main.temp_max === "number";
}

export function formatWeatherTemperature(value: number) {
	return `${Math.round(value)}°C`;
}

export function formatWeatherWindSpeed(value: number) {
	return `${Math.round(value * 3.6)} km/h`;
}

export function formatWeatherHour(value: string) {
	return new Intl.DateTimeFormat("en-GB", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).format(new Date(value));
}

export function formatWeatherWeekday(value: string) {
	return new Intl.DateTimeFormat(undefined, {
		weekday: "short",
		timeZone: "UTC",
	}).format(new Date(`${value}T00:00:00.000Z`));
}

export function resolveWeatherDailyRangeSegments(
	forecast: WeatherDailyForecast[],
): WeatherDailyRangeSegment[] {
	const minTemp = Math.min(...forecast.map((item) => item.tempMin));
	const maxTemp = Math.max(...forecast.map((item) => item.tempMax));
	const span = maxTemp - minTemp;

	if (!Number.isFinite(span) || span <= 0) {
		return forecast.map(() => ({ offsetPercent: 0, widthPercent: 100 }));
	}

	return forecast.map((item) => ({
		offsetPercent: Math.round(((item.tempMin - minTemp) / span) * 100),
		widthPercent: Math.max(4, Math.round(((item.tempMax - item.tempMin) / span) * 100)),
	}));
}
