"use client";

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  XAxis,
  YAxis,
} from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent } from "./ui/chart";

interface MetricDataPoint {
  timestamp: string;
  provider: string;
  latency: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface CombinedMetricsChartProps {
  data: MetricDataPoint[];
  interval: number;
}

export function CombinedMetricsChart({
  data,
  interval = 60,
}: CombinedMetricsChartProps) {
  if (!data?.length) {
    return (
      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
        No data available
      </div>
    );
  }

  const sanitizedData = data
    .map((point) => ({
      timestamp: point.timestamp || "",
      provider: point.provider || "unknown",
      latency: typeof point.latency === "number" ? point.latency : 0,
      promptTokens:
        typeof point.promptTokens === "number" ? point.promptTokens : 0,
      completionTokens:
        typeof point.completionTokens === "number" ? point.completionTokens : 0,
      totalTokens:
        typeof point.totalTokens === "number" ? point.totalTokens : 0,
    }))
    .sort((a, b) => {
      const dateA = new Date(a.timestamp.replace(" ", "T")).getTime();
      const dateB = new Date(b.timestamp.replace(" ", "T")).getTime();
      return dateA - dateB;
    });

  const extendedData = [...sanitizedData];
  const lastEntry = sanitizedData[sanitizedData.length - 1];

  if (lastEntry?.timestamp) {
    const currentDate = new Date();
    const lastEntryDate = new Date(lastEntry.timestamp.replace(" ", "T"));

    if (!Number.isNaN(lastEntryDate.getTime())) {
      while (lastEntryDate < currentDate) {
        lastEntryDate.setMinutes(lastEntryDate.getMinutes() + interval);

        if (lastEntryDate < currentDate) {
          const interpolatedTimestamp = `${lastEntryDate.toISOString().split("T")[0]} ${lastEntryDate.getHours().toString().padStart(2, "0")}:${lastEntryDate.getMinutes().toString().padStart(2, "0")}`;

          extendedData.push({
            timestamp: interpolatedTimestamp,
            provider: lastEntry.provider,
            latency: 0,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
          });
        }
      }

      const currentMinutes = currentDate.getMinutes();
      const roundedMinutes = Math.floor(currentMinutes / interval) * interval;
      currentDate.setMinutes(roundedMinutes);

      const currentTimestamp = `${currentDate.toISOString().split("T")[0]} ${currentDate.getHours().toString().padStart(2, "0")}:${currentDate.getMinutes().toString().padStart(2, "0")}`;

      if (currentTimestamp > lastEntry.timestamp) {
        extendedData.push({
          timestamp: currentTimestamp,
          provider: lastEntry.provider,
          latency: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        });
      }
    }
  }

  const formatLatency = (value: number) => `${value.toLocaleString()}ms`;
  const formatTokens = (value: number) => `${value.toLocaleString()}`;
  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return "";
    try {
      // support both space and ISO 'T' separators
      const normalized = timestamp.includes("T")
        ? timestamp
        : timestamp.replace(" ", "T");
      const dateObj = new Date(normalized);
      if (Number.isNaN(dateObj.getTime())) {
        return timestamp;
      }
      const hours = dateObj.getHours().toString().padStart(2, "0");
      const minutes = dateObj.getMinutes().toString().padStart(2, "0");
      // show clock time only for readability
      return `${hours}:${minutes}`;
    } catch (error) {
      console.error("Error formatting timestamp:", timestamp);
      return timestamp;
    }
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
      <ComposedChart
        data={extendedData}
        margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
        <XAxis
          dataKey="timestamp"
          angle={-45}
          textAnchor="end"
          height={60}
          interval="preserveStartEnd"
          tick={{ fontSize: 11, fill: "var(--foreground)" }}
          tickFormatter={formatTimestamp}
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
          content={<ChartTooltipContent />}
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
        <Bar yAxisId="left" dataKey="latency" name="Latency (ms)" opacity={0.9}>
          {extendedData.map((entry, index) => (
            <Cell
              key={`cell-${index}-${entry.timestamp}`}
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
            type="monotone"
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
            type="monotone"
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
            type="monotone"
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
