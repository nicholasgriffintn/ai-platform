import { Droplets, Wind } from "lucide-react";

import { cn } from "~/lib/utils";
import {
	formatWeatherHour,
	formatWeatherTemperature,
	formatWeatherWeekday,
	formatWeatherWindSpeed,
	hasWeatherMinMax,
	isWeatherData,
	resolveWeatherDailyRangeSegments,
	type WeatherDailyForecast,
	type WeatherDailyRangeSegment,
} from "~/lib/weather";
import { getWeatherIcon } from "~/lib/weather-icons";

interface WeatherViewProps {
	data: unknown;
	embedded: boolean;
}

const MAX_HOURLY_ITEMS = 7;
const MAX_DAILY_ITEMS = 6;

export function WeatherView({ data, embedded }: WeatherViewProps) {
	if (!isWeatherData(data)) {
		return null;
	}

	const condition = data.weather?.[0];
	const hourlyForecast = data.forecast?.hourly?.slice(0, MAX_HOURLY_ITEMS) ?? [];
	const dailyForecast = data.forecast?.daily?.slice(0, MAX_DAILY_ITEMS) ?? [];
	const dailyRangeSegments = resolveWeatherDailyRangeSegments(dailyForecast);
	const Icon = getWeatherIcon(condition);
	const locationName = data.name ?? "Current location";

	return (
		<section
			aria-label={`Weather forecast for ${locationName}`}
			className={cn(
				"w-full overflow-hidden rounded-lg border border-zinc-200 bg-off-white text-zinc-900 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50",
				embedded ? "max-w-full" : "max-w-2xl",
			)}
			role="region"
		>
			<div className="p-4 sm:p-5">
				<div className="flex items-start justify-between gap-4">
					<div>
						<p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{locationName}</p>
						<div className="mt-4 flex items-center gap-4">
							<div className="flex h-14 w-14 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
								<Icon className="h-8 w-8" aria-hidden />
							</div>
							<div>
								<div className="flex items-start gap-1">
									<span className="text-5xl font-semibold tracking-normal">
										{formatWeatherTemperature(data.main.temp)}
									</span>
								</div>
								<p className="mt-1 text-sm capitalize text-zinc-600 dark:text-zinc-400">
									{condition?.description ?? condition?.main ?? "Current conditions"}
								</p>
							</div>
						</div>
					</div>

					<div className="grid min-w-32 gap-2 text-right text-sm text-zinc-500 dark:text-zinc-400">
						<p>now</p>
						{hasWeatherMinMax(data) && (
							<p className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
								{formatWeatherTemperature(data.main.temp_max)}{" "}
								<span className="font-normal text-zinc-400">
									{formatWeatherTemperature(data.main.temp_min)}
								</span>
							</p>
						)}
						{typeof data.main.feels_like === "number" && (
							<p>feels like {formatWeatherTemperature(data.main.feels_like)}</p>
						)}
						<div className="flex flex-wrap justify-end gap-x-3 gap-y-1">
							{typeof data.main.humidity === "number" && (
								<span className="inline-flex items-center gap-1">
									<Droplets className="h-3.5 w-3.5" aria-hidden />
									{data.main.humidity}%
								</span>
							)}
							{typeof data.wind?.speed === "number" && (
								<span className="inline-flex items-center gap-1">
									<Wind className="h-3.5 w-3.5" aria-hidden />
									{formatWeatherWindSpeed(data.wind.speed)}
								</span>
							)}
						</div>
					</div>
				</div>

				{hourlyForecast.length > 0 && (
					<div className="mt-5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
						<div className="grid auto-cols-fr grid-flow-col gap-2 overflow-x-auto pb-1">
							{hourlyForecast.map((item, index) => {
								const HourlyIcon = getWeatherIcon(item);
								return (
									<div
										className="grid min-w-16 justify-items-center gap-2 rounded-md px-2 py-2 text-center"
										key={`${item.time}-${index}`}
									>
										<span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
											{index === 0 ? "Now" : formatWeatherHour(item.time)}
										</span>
										<HourlyIcon className="h-5 w-5 text-zinc-600 dark:text-zinc-300" aria-hidden />
										<span className="text-sm font-semibold">
											{formatWeatherTemperature(item.temp)}
										</span>
									</div>
								);
							})}
						</div>
					</div>
				)}

				{dailyForecast.length > 0 && (
					<div className="mt-5 space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
						{dailyForecast.map((item, index) => (
							<DailyForecastRow
								key={`${item.date}-${index}`}
								item={item}
								label={index === 0 ? "Today" : formatWeatherWeekday(item.date)}
								rangeSegment={dailyRangeSegments[index]}
							/>
						))}
					</div>
				)}
			</div>
		</section>
	);
}

function DailyForecastRow({
	item,
	label,
	rangeSegment,
}: {
	item: WeatherDailyForecast;
	label: string;
	rangeSegment?: WeatherDailyRangeSegment;
}) {
	const Icon = getWeatherIcon(item);
	const precipitation = item.precipitationProbability ?? 0;
	const offsetPercent = rangeSegment?.offsetPercent ?? 0;
	const widthPercent = rangeSegment?.widthPercent ?? 100;

	return (
		<div className="grid grid-cols-[4rem_2rem_3rem_1fr] items-center gap-2 text-sm">
			<div className="font-semibold text-zinc-700 dark:text-zinc-200">{label}</div>
			<Icon className="h-4 w-4 text-zinc-500 dark:text-zinc-400" aria-hidden />
			<div className="text-xs font-medium text-sky-600 dark:text-sky-400">
				{precipitation > 0 ? `${precipitation}%` : ""}
			</div>
			<div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2">
				<span className="text-right text-zinc-400">{formatWeatherTemperature(item.tempMin)}</span>
				<span
					aria-label={`${label} temperature range`}
					className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
				>
					<span
						className="block h-full rounded-full bg-gradient-to-r from-sky-400 via-emerald-300 to-amber-400"
						style={{ marginLeft: `${offsetPercent}%`, width: `${widthPercent}%` }}
					/>
				</span>
				<span className="font-semibold text-zinc-700 dark:text-zinc-200">
					{formatWeatherTemperature(item.tempMax)}
				</span>
			</div>
		</div>
	);
}
