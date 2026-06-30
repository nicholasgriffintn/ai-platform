interface OpenWeatherForecastResponse {
	cod?: string | number;
	list?: OpenWeatherForecastItem[];
}

interface OpenWeatherForecastItem {
	dt?: number;
	main?: {
		temp?: number;
		temp_min?: number;
		temp_max?: number;
		humidity?: number;
	};
	weather?: {
		description?: string;
		icon?: string;
	}[];
	wind?: {
		speed?: number;
	};
	pop?: number;
}

export interface WeatherForecast {
	hourly: WeatherHourlyForecast[];
	daily: WeatherDailyForecast[];
}

export interface WeatherHourlyForecast {
	time: string;
	temp: number;
	description: string;
	icon?: string;
	precipitationProbability: number;
	humidity?: number;
	windSpeed?: number;
}

export interface WeatherDailyForecast {
	date: string;
	tempMin: number;
	tempMax: number;
	description: string;
	icon?: string;
	precipitationProbability: number;
}

interface DailyAccumulator {
	date: string;
	tempMin: number;
	tempMax: number;
	description: string;
	icon?: string;
	precipitationProbability: number;
}

const MAX_HOURLY_ITEMS = 8;
const MAX_DAILY_ITEMS = 5;

export async function getOpenWeatherForecast(
	apiKey: string,
	location: { latitude: number; longitude: number },
): Promise<WeatherForecast | undefined> {
	try {
		const forecastResponse = await fetch(getOpenWeatherUrl("forecast", apiKey, location));

		if (!forecastResponse.ok) {
			return undefined;
		}

		return normaliseWeatherForecast(await forecastResponse.json());
	} catch {
		return undefined;
	}
}

export function getOpenWeatherUrl(
	resource: "weather" | "forecast",
	apiKey: string,
	location: { latitude: number; longitude: number },
) {
	return `https://api.openweathermap.org/data/2.5/${resource}?lat=${location.latitude}&lon=${location.longitude}&units=metric&appid=${apiKey}`;
}

export function normaliseWeatherForecast(
	forecast: OpenWeatherForecastResponse,
): WeatherForecast | undefined {
	if (String(forecast.cod) !== "200" || !Array.isArray(forecast.list)) {
		return undefined;
	}

	const hourly = forecast.list
		.map(normaliseForecastItem)
		.filter((item): item is WeatherHourlyForecast => Boolean(item))
		.slice(0, MAX_HOURLY_ITEMS);

	if (hourly.length === 0) {
		return undefined;
	}

	return {
		hourly,
		daily: normaliseDailyForecast(forecast.list),
	};
}

function normaliseForecastItem(item: OpenWeatherForecastItem): WeatherHourlyForecast | undefined {
	if (typeof item.dt !== "number" || typeof item.main?.temp !== "number") {
		return undefined;
	}

	const condition = item.weather?.[0];

	return {
		time: new Date(item.dt * 1000).toISOString(),
		temp: item.main.temp,
		description: condition?.description ?? "forecast",
		icon: condition?.icon,
		precipitationProbability: normalisePrecipitationProbability(item.pop),
		humidity: item.main.humidity,
		windSpeed: item.wind?.speed,
	};
}

function normaliseDailyForecast(items: OpenWeatherForecastItem[]): WeatherDailyForecast[] {
	const daily = new Map<string, DailyAccumulator>();

	for (const item of items) {
		if (typeof item.dt !== "number" || !item.main) {
			continue;
		}

		const date = new Date(item.dt * 1000).toISOString().slice(0, 10);
		const tempMin = item.main.temp_min ?? item.main.temp;
		const tempMax = item.main.temp_max ?? item.main.temp;

		if (typeof tempMin !== "number" || typeof tempMax !== "number") {
			continue;
		}

		const condition = item.weather?.[0];
		const precipitationProbability = normalisePrecipitationProbability(item.pop);
		const existing = daily.get(date);

		if (!existing) {
			daily.set(date, {
				date,
				tempMin,
				tempMax,
				description: condition?.description ?? "forecast",
				icon: condition?.icon,
				precipitationProbability,
			});
			continue;
		}

		existing.tempMin = Math.min(existing.tempMin, tempMin);
		existing.tempMax = Math.max(existing.tempMax, tempMax);

		if (precipitationProbability > existing.precipitationProbability) {
			existing.precipitationProbability = precipitationProbability;
			existing.description = condition?.description ?? existing.description;
			existing.icon = condition?.icon ?? existing.icon;
		}
	}

	return [...daily.values()].slice(0, MAX_DAILY_ITEMS);
}

function normalisePrecipitationProbability(value: unknown): number {
	return typeof value === "number" ? Math.round(value * 100) : 0;
}
