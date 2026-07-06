export interface MetricDataPoint {
	timestamp: string;
	provider: string;
	latency: number;
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
}

export interface MetricsChartPoint extends MetricDataPoint {
	time: number;
}

interface BuildMetricsChartDataOptions {
	data: MetricDataPoint[];
	interval: number;
	now?: Date;
	maxGeneratedBuckets?: number;
}

const DEFAULT_INTERVAL_MINUTES = 60;
const DEFAULT_MAX_GENERATED_BUCKETS = 720;

export function buildMetricsChartData({
	data,
	interval,
	now = new Date(),
	maxGeneratedBuckets = DEFAULT_MAX_GENERATED_BUCKETS,
}: BuildMetricsChartDataOptions): MetricsChartPoint[] {
	const intervalMinutes = sanitiseInterval(interval);
	const cappedBuckets = Math.max(0, Math.floor(maxGeneratedBuckets));
	const nowTime = now.getTime();

	const sanitisedData = data
		.map(toChartPoint)
		.filter((point): point is MetricsChartPoint => point !== null)
		.sort((a, b) => a.time - b.time);

	const extendedData = [...sanitisedData];
	const lastEntry = sanitisedData[sanitisedData.length - 1];

	if (!lastEntry || Number.isNaN(nowTime)) {
		return extendedData;
	}

	const cursor = new Date(lastEntry.time);
	let generatedBuckets = 0;

	while (generatedBuckets < cappedBuckets) {
		cursor.setMinutes(cursor.getMinutes() + intervalMinutes);

		if (cursor.getTime() >= nowTime) {
			break;
		}

		extendedData.push(createEmptyPoint(cursor, lastEntry.provider));
		generatedBuckets += 1;
	}

	const currentBucket = roundDownToInterval(now, intervalMinutes);
	const currentBucketTime = currentBucket.getTime();
	const finalPointTime = extendedData[extendedData.length - 1]?.time ?? lastEntry.time;

	if (
		generatedBuckets < cappedBuckets &&
		currentBucketTime > finalPointTime &&
		currentBucketTime > lastEntry.time
	) {
		extendedData.push(createEmptyPoint(currentBucket, lastEntry.provider));
	}

	return extendedData;
}

function toChartPoint(point: MetricDataPoint): MetricsChartPoint | null {
	const timestamp = normaliseTimestamp(point.timestamp);
	const time = new Date(timestamp).getTime();

	if (Number.isNaN(time)) {
		return null;
	}

	return {
		timestamp,
		time,
		provider: point.provider || "unknown",
		latency: readNumber(point.latency),
		promptTokens: readNumber(point.promptTokens),
		completionTokens: readNumber(point.completionTokens),
		totalTokens: readNumber(point.totalTokens),
	};
}

function createEmptyPoint(date: Date, provider: string): MetricsChartPoint {
	return {
		timestamp: formatChartTimestamp(date),
		time: date.getTime(),
		provider,
		latency: 0,
		promptTokens: 0,
		completionTokens: 0,
		totalTokens: 0,
	};
}

function roundDownToInterval(date: Date, intervalMinutes: number): Date {
	const roundedDate = new Date(date);
	const roundedMinutes = Math.floor(roundedDate.getMinutes() / intervalMinutes) * intervalMinutes;
	roundedDate.setMinutes(roundedMinutes, 0, 0);
	return roundedDate;
}

function normaliseTimestamp(timestamp: string): string {
	const raw = timestamp || "";
	return raw.includes("T") ? raw : raw.replace(" ", "T");
}

function formatChartTimestamp(date: Date): string {
	return `${date.toISOString().split("T")[0]} ${date
		.getHours()
		.toString()
		.padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

function sanitiseInterval(interval: number): number {
	return Number.isFinite(interval) && interval > 0 ? interval : DEFAULT_INTERVAL_MINUTES;
}

function readNumber(value: number): number {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
