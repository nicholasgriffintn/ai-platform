import { X } from "lucide-react";

import type { Metric } from "../types";
import { Button } from "./ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";

interface MetricDetailsProps {
	metric: Metric;
	onClose: () => void;
}

export function MetricDetails({ metric, onClose }: MetricDetailsProps) {
	const metadata = JSON.parse(metric.metadata);

	return (
		<div className="fixed inset-y-0 right-0 w-[400px] bg-background border-l shadow-lg transform transition-transform z-50">
			<Card className="h-full rounded-none">
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<div className="space-y-1">
						<CardTitle>Metric Details</CardTitle>
						<CardDescription>
							{metadata.provider} ({metadata.model})
						</CardDescription>
					</div>
					<Button variant="ghost" size="icon" onClick={onClose}>
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
		</div>
	);
}
