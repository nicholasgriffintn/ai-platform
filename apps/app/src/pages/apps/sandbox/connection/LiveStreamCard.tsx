import type { RefObject } from "react";

import {
	Badge,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui";
import { formatRelativeTime } from "~/lib/dates";
import type { SandboxRun } from "~/types/sandbox";
import { describeEvent } from "../utils";

import { getEventDetailLines } from "./helpers";
import type { TimelineEvent } from "./types";

interface Props {
	timeline: TimelineEvent[];
	isSubmitting: boolean;
	selectedRun: SandboxRun | undefined;
	timelineEndRef: RefObject<HTMLDivElement | null>;
}

export function LiveStreamCard({
	timeline,
	isSubmitting,
	selectedRun,
	timelineEndRef,
}: Props) {
	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between gap-2">
					<CardTitle>Live stream</CardTitle>
					{isSubmitting && (
						<Badge variant="secondary" className="gap-1">
							<span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
							Live
						</Badge>
					)}
					{!isSubmitting && selectedRun && (
						<Badge variant="outline" className="text-xs">
							Historical
						</Badge>
					)}
				</div>
				<CardDescription>
					{isSubmitting
						? "Real-time events from the current execution"
						: "Command-level events from selected run history"}
				</CardDescription>
			</CardHeader>
			<CardContent className="max-h-96 overflow-auto">
				{timeline.length === 0 ? (
					<div className="text-sm text-muted-foreground">
						Waiting for events...
					</div>
				) : (
					<div className="space-y-2">
						{timeline.map((entry) => {
							const detailLines = getEventDetailLines(entry.event);
							return (
								<div
									key={entry.id}
									className="rounded-md border border-zinc-200/80 p-2 text-xs dark:border-zinc-700/70"
								>
									<div className="flex items-center justify-between gap-2">
										<span className="font-medium">{entry.event.type}</span>
										<span className="text-muted-foreground">
											{formatRelativeTime(entry.receivedAt)}
										</span>
									</div>
									<p className="mt-1 text-muted-foreground break-words">
										{describeEvent(entry.event)}
									</p>
									{detailLines.length > 0 && (
										<pre className="mt-2 whitespace-pre-wrap break-words rounded bg-muted/40 p-2 text-[11px] text-muted-foreground">
											{detailLines.join("\n\n")}
										</pre>
									)}
								</div>
							);
						})}
						<div ref={timelineEndRef} />
					</div>
				)}
			</CardContent>
		</Card>
	);
}
