export interface Metric {
	type: string;
	name: string;
	status: string;
	error: string;
	traceId: string;
	metadata: string;
	value: number;
	timestamp: string;
	truncated_time: string;
	sampleCount: string;
	minutesAgo: number;
}
