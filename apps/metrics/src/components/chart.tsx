"use client";

import { Bar, CartesianGrid, Cell, ComposedChart, Legend, Line, XAxis, YAxis } from "recharts";

import { buildMetricsChartData, type MetricDataPoint } from "./chart-data";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "./ui/chart";

interface CombinedMetricsChartProps {
	data: MetricDataPoint[];
	interval: number;
}

export function CombinedMetricsChart({ data, interval = 60 }: CombinedMetricsChartProps) {
	if (!data?.length) {
		return (
			<div className="flex h-full w-full items-center justify-center text-muted-foreground">
				No data available
			</div>
		);
	}

	const extendedData = buildMetricsChartData({ data, interval });

	const formatLatency = (value: number) => `${value.toLocaleString()}ms`;
	const formatTokens = (value: number) => `${value.toLocaleString()}`;

	const xTickFormatter = (msValue: number | string) => {
		const timeNum = typeof msValue === "number" ? msValue : Number(msValue);
		const date = new Date(timeNum);
		if (Number.isNaN(date.getTime())) return "";

		const isStartOfDay = date.getHours() < 3;

		if (isStartOfDay) {
			return date.toLocaleString(undefined, {
				month: "short",
				day: "2-digit",
				hour: "2-digit",
				minute: "2-digit",
			});
		}
		return date.toLocaleString(undefined, {
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const providerColors: { [key: string]: string } = {
		anthropic: "#FF6B6B",
		bedrock: "#4682B4",
		deepseek: "#4D6BFE",
		"github-models": "#2196F3",
		"google-ai-studio": "#4CAF50",
		grok: "#9370DB",
		groq: "#FF4500",
		huggingface: "#ffd21f",
		mistral: "#20B2AA",
		ollama: "#262626",
		openai: "#6A5ACD",
		openrouter: "#FF69B4",
		"perplexity-ai": "#FFD700",
		replicate: "#1E90FF",
		"together-ai": "#0f6fff",
		workers: "#5F9EA0",
	};

	const getProviderColor = (provider: string) => {
		if (!provider) return "#0071f1";
		const normalizedProvider = provider.toLowerCase();
		return providerColors[normalizedProvider] || "#0071f1";
	};

	return (
		<ChartContainer
			config={{
				latency: {
					label: "Latency (ms)",
					color: "hsl(var(--chart-1))",
				},
				promptTokens: {
					label: "Prompt Tokens",
					color: "hsl(var(--chart-2))",
				},
				completionTokens: {
					label: "Completion Tokens",
					color: "hsl(var(--chart-3))",
				},
				totalTokens: {
					label: "Total Tokens",
					color: "hsl(var(--chart-4))",
				},
			}}
			className="h-full w-full"
		>
			<ComposedChart data={extendedData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
				<CartesianGrid strokeDasharray="3 3" opacity={0.2} />
				<XAxis
					dataKey="time"
					type="number"
					scale="time"
					domain={["dataMin", "dataMax"]}
					tickCount={6}
					angle={-45}
					textAnchor="end"
					height={60}
					interval="preserveStartEnd"
					tick={{ fontSize: 11, fill: "var(--foreground)" }}
					tickFormatter={xTickFormatter}
				/>
				<YAxis
					yAxisId="left"
					orientation="left"
					stroke="var(--foreground)"
					tick={{ fontSize: 11, fill: "var(--foreground)" }}
					tickFormatter={formatLatency}
					width={80}
				/>
				<YAxis
					yAxisId="right"
					orientation="right"
					stroke="var(--foreground)"
					tick={{ fontSize: 11, fill: "var(--foreground)" }}
					tickFormatter={formatTokens}
					width={80}
				/>
				<ChartTooltip
					content={(props) => <ChartTooltipContent {...props} />}
					cursor={{ fill: "rgba(255, 255, 255, 0.1)" }}
				/>
				<Legend
					verticalAlign="top"
					height={24}
					iconSize={10}
					wrapperStyle={{
						paddingBottom: "10px",
						fontSize: "12px",
					}}
				/>
				<Bar yAxisId="left" dataKey="latency" name="Latency (ms)" opacity={0.9} barSize={12}>
					{extendedData.map((entry, index) => (
						<Cell
							key={`cell-${index}-${entry.time}`}
							fill={getProviderColor(entry.provider)}
							style={{
								filter: "brightness(1.1)",
							}}
						/>
					))}
				</Bar>
				{extendedData.some((d) => d.promptTokens > 0) && (
					<Line
						yAxisId="right"
						type="linear"
						dataKey="promptTokens"
						stroke="#00F5D4"
						strokeWidth={2}
						name="Prompt Tokens"
						dot={false}
					/>
				)}
				{extendedData.some((d) => d.completionTokens > 0) && (
					<Line
						yAxisId="right"
						type="linear"
						dataKey="completionTokens"
						stroke="#FF6B6B"
						strokeWidth={2}
						name="Completion Tokens"
						dot={false}
					/>
				)}
				{extendedData.some((d) => d.totalTokens > 0) && (
					<Line
						yAxisId="right"
						type="linear"
						dataKey="totalTokens"
						stroke="#FEE440"
						strokeWidth={2}
						name="Total Tokens"
						dot={false}
					/>
				)}
			</ComposedChart>
		</ChartContainer>
	);
}
