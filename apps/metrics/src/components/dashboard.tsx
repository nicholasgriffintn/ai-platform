"use client";

import { useState } from "react";

import type { Metric } from "../types";
import { CombinedMetricsChart } from "./chart";
import { MetricDetails } from "./details";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "./ui/table";

const parseMetadata = (metadataString: string) => {
	try {
		if (!metadataString) {
			return {};
		}
		return JSON.parse(metadataString);
	} catch (error) {
		console.error("Error parsing metadata:", error);
		return {};
	}
};

interface MetricsDashboardProps {
	metrics: Metric[];
	interval: number;
	limit: number;
}

export function MetricsDashboard({
	metrics,
	interval,
	limit,
}: MetricsDashboardProps) {
	const [selectedMetric, setSelectedMetric] = useState<Metric | null>(null);

	const totalRequests = metrics.length;
	const totalTokens = metrics.reduce((sum, metric) => {
		const metadata = parseMetadata(metric.metadata);
		return sum + (metadata.tokenUsage?.total_tokens || 0);
	}, 0);
	const totalCost = metrics.reduce((sum, metric) => {
		const metadata = parseMetadata(metric.metadata);
		return sum + (metadata.cost || 0);
	}, 0);
	const cachedRequests = metrics.filter((m) => {
		const metadata = parseMetadata(m.metadata);
		return metadata.cached === "true";
	}).length;
	const cachedPercentage = ((cachedRequests / totalRequests) * 100).toFixed(2);
	const errorRequests = metrics.filter((m) => m.status === "error").length;

	const combinedChartData = metrics
		.map((metric) => {
			const metadata = parseMetadata(metric.metadata);
			const tokenUsage = metadata.tokenUsage || {};
			return {
				name: `${metadata.provider} (${metadata.model})`,
				latency: metric.value,
				promptTokens: tokenUsage.prompt_tokens || 0,
				completionTokens: tokenUsage.completion_tokens || 0,
				totalTokens: tokenUsage.total_tokens || 0,
				timestamp: metric.timestamp.replace(" ", "T"),
				provider: metadata.provider || "unknown",
			};
		})
		.sort(
			(a, b) =>
				new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
		);

	return (
		<div className="space-y-6">
			<div className="grid grid-cols-2 md:grid-cols-5 gap-4">
				<Card>
					<CardHeader className="p-4">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Requests
						</CardTitle>
						<CardDescription className="text-2xl font-bold">
							{totalRequests}
							{limit === totalRequests && (
								<span className="ml-2 text-xs text-muted-foreground">
									(limited to {limit})
								</span>
							)}
						</CardDescription>
					</CardHeader>
				</Card>
				<Card>
					<CardHeader className="p-4">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Tokens
						</CardTitle>
						<CardDescription className="text-2xl font-bold">
							{(totalTokens / 1000).toFixed(1)}k
						</CardDescription>
					</CardHeader>
				</Card>
				<Card>
					<CardHeader className="p-4">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Cost
						</CardTitle>
						<CardDescription className="text-2xl font-bold">
							${totalCost.toFixed(2)}
							<span className="ml-2 text-xs text-muted-foreground">
								Not available
							</span>
						</CardDescription>
					</CardHeader>
				</Card>
				<Card>
					<CardHeader className="p-4">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Cached
						</CardTitle>
						<CardDescription className="text-2xl font-bold">
							{cachedPercentage}%
							<span className="ml-2 text-xs text-muted-foreground">
								Not available
							</span>
						</CardDescription>
					</CardHeader>
				</Card>
				<Card>
					<CardHeader className="p-4">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Errors
						</CardTitle>
						<CardDescription className="text-2xl font-bold">
							{errorRequests}
							<span className="ml-2 text-xs text-muted-foreground">
								Not available
							</span>
						</CardDescription>
					</CardHeader>
				</Card>
			</div>

			<div className="space-y-6">
				<Card>
					<CardHeader>
						<CardTitle>AI Provider Metrics</CardTitle>
						<CardDescription>
							Latency and token usage for different AI providers and models
						</CardDescription>
					</CardHeader>
					<CardContent className="h-[400px]">
						<CombinedMetricsChart
							data={combinedChartData}
							interval={interval}
						/>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Metrics Details</CardTitle>
						<CardDescription>
							Detailed information for each metric entry
						</CardDescription>
					</CardHeader>
					<CardContent className="h-[400px] p-0">
						<ScrollArea className="h-full">
							<div className="p-4">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Provider (Model)</TableHead>
											<TableHead>Latency (ms)</TableHead>
											<TableHead>Total Tokens</TableHead>
											<TableHead>Status</TableHead>
											<TableHead>Timestamp</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{metrics.map((metric, idx) => {
											const metadata = parseMetadata(metric.metadata);
											const tokenUsage = metadata.tokenUsage || {};
											return (
												<TableRow
													key={`${metric.traceId}-${idx}`}
													className="cursor-pointer hover:bg-muted/50"
													onClick={() => setSelectedMetric(metric)}
												>
													<TableCell>{`${metadata.provider} (${metadata.model})`}</TableCell>
													<TableCell>{metric.value}</TableCell>
													<TableCell>
														{tokenUsage.total_tokens || "N/A"}
													</TableCell>
													<TableCell>{metric.status}</TableCell>
													<TableCell>{metric.timestamp}</TableCell>
												</TableRow>
											);
										})}
									</TableBody>
								</Table>
							</div>
						</ScrollArea>
					</CardContent>
				</Card>
			</div>

			{selectedMetric && (
				<MetricDetails
					metric={selectedMetric}
					onClose={() => setSelectedMetric(null)}
				/>
			)}
		</div>
	);
}
