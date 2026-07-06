import { X } from "lucide-react";

import { parseMetricMetadata } from "../lib/metrics";
import type { Metric } from "../types";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";

interface MetricDetailsProps {
	metric: Metric;
	onClose: () => void;
}

export function MetricDetails({ metric, onClose }: MetricDetailsProps) {
	const metadata = parseMetricMetadata(metric.metadata);
	const providerLabel = metadata.provider === "unknown" ? "Unknown provider" : metadata.provider;

	return (
		<aside
			aria-label="Metric details"
			className="fixed inset-y-0 right-0 z-50 w-full max-w-[400px] transform border-l bg-background shadow-lg transition-transform"
		>
			<Card className="h-full rounded-none">
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<div className="space-y-1">
						<CardTitle>Metric Details</CardTitle>
						<CardDescription>
							{providerLabel} ({metadata.model})
						</CardDescription>
					</div>
					<Button variant="ghost" size="icon" onClick={onClose} aria-label="Close metric details">
						<X className="h-4 w-4" />
					</Button>
				</CardHeader>
				<CardContent>
					<ScrollArea className="h-[calc(100vh-120px)]">
						<pre className="bg-muted p-4 rounded-md overflow-auto whitespace-pre-wrap break-all">
							{JSON.stringify(metadata, null, 2)}
						</pre>
					</ScrollArea>
				</CardContent>
			</Card>
		</aside>
	);
}
