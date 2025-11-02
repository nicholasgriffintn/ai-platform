import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { MetricsControls } from "../components/controls";
import { MetricsDashboard } from "../components/dashboard";
import { Layout } from "../components/layout";

interface MetricsParams {
	status: string;
	limit: number;
	interval: number;
	timeframe: number;
}

async function fetchMetrics(params: MetricsParams) {
	const searchParams = new URLSearchParams({
		status: params.status,
		limit: params.limit.toString(),
		interval: params.interval.toString(),
		timeframe: params.timeframe.toString(),
		type: "performance",
	});

	const response = await fetch(
		`https://api.polychat.app/metrics?${searchParams}`,
	);
	if (!response.ok) {
		throw new Error("Failed to fetch metrics");
	}
	return response.json();
}

export const metadata = {
	title: "Polychat Metrics",
	description:
		"See the performance metrics from the Polychat AI Assistant and how it responds across different models.",
};

export function MetricsHome() {
	const [filters, setFilters] = useState<MetricsParams>({
		status: "success",
		limit: 100,
		interval: 30,
		timeframe: 24,
	});

	const trackEvent = useCallback(
		(event: {
			name: string;
			category: string;
			label?: string;
			value?: number | string;
			nonInteraction?: boolean;
			properties?: Record<string, string>;
		}) => {
			if (window.Beacon) {
				window.Beacon.trackEvent(event);
			}
		},
		[],
	);

	const {
		data = { metrics: [] },
		isLoading,
		error,
	} = useQuery({
		queryKey: ["metrics", filters],
		queryFn: () => fetchMetrics(filters),
	});

	const handleFilterChange = (newFilters: MetricsParams) => {
		trackEvent({
			name: "filter_change",
			category: "metrics",
			label: "metrics_dashboard",
			value: `${newFilters.status}|${newFilters.limit}|${newFilters.interval}|${newFilters.timeframe}`,
		});

		setFilters(newFilters);
	};

	return (
		<Layout>
			<div className="space-y-6">
				<div className="flex flex-col gap-4">
					<div className="w-full">
						<h1 className="text-2xl md:text-4xl font-bold">Polychat Metrics</h1>
					</div>
					<div className="w-full">
						<MetricsControls
							initialValues={filters}
							onSubmit={handleFilterChange}
						/>
					</div>
				</div>
				{isLoading ? (
					<div className="text-center text-muted-foreground">Loading...</div>
				) : error ? (
					<div className="text-center text-red-500">Error loading metrics</div>
				) : data.metrics?.length > 0 ? (
					<MetricsDashboard
						metrics={data.metrics}
						interval={filters.interval}
						limit={filters.limit}
					/>
				) : (
					<div className="text-center text-muted-foreground">
						No metrics found
					</div>
				)}
			</div>
		</Layout>
	);
}
