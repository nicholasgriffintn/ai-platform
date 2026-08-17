import { Cloud, CloudDrizzle, CloudLightning, CloudRain, CloudSnow, Sun } from "lucide-react";
import type { ComponentType } from "react";

import type { WeatherCondition, WeatherDailyForecast, WeatherHourlyForecast } from "./weather";

export type WeatherIcon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

export function getWeatherIcon(
	condition: WeatherCondition | WeatherHourlyForecast | WeatherDailyForecast | undefined,
): WeatherIcon {
	const main = condition && "main" in condition ? condition.main : "";
	const text = `${condition?.description ?? ""} ${main ?? ""}`.toLowerCase();

	if (text.includes("thunder")) {
		return CloudLightning;
	}

	if (text.includes("snow") || text.includes("sleet")) {
		return CloudSnow;
	}

	if (text.includes("rain")) {
		return CloudRain;
	}

	if (text.includes("drizzle")) {
		return CloudDrizzle;
	}

	if (text.includes("cloud")) {
		return Cloud;
	}

	return Sun;
}
