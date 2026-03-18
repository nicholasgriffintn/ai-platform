import {
	Alert,
	AlertDescription,
	AlertTitle,
	Badge,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui";
import { formatRelativeTime } from "~/lib/dates";
import { cn } from "~/lib/utils";
import type { SandboxRun } from "~/types/sandbox";
import { getStatusBadgeVariant } from "../utils";

interface Props {
	runs: SandboxRun[];
	isRunsLoading: boolean;
	runsError: unknown;
	targetRunId: string | undefined;
	onSelectRun: (runId: string) => void;
}

export function RunHistoryCard({
	runs,
	isRunsLoading,
	runsError,
	targetRunId,
	onSelectRun,
}: Props) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Run history</CardTitle>
				<CardDescription>
					Recent executions for this installation.
				</CardDescription>
			</CardHeader>
			<CardContent className="max-h-[400px] overflow-auto">
				{isRunsLoading ? (
					<div className="text-sm text-muted-foreground">Loading runs...</div>
				) : runsError ? (
					<Alert variant="destructive">
						<AlertTitle>Unable to load run history</AlertTitle>
						<AlertDescription>
							{runsError instanceof Error ? runsError.message : "Unknown error"}
						</AlertDescription>
					</Alert>
				) : runs.length === 0 ? (
					<div className="text-sm text-muted-foreground">
						No runs yet for this connection.
					</div>
				) : (
					<div className="space-y-2">
						{runs.map((run) => (
							<button
								type="button"
								key={run.runId}
								onClick={() => onSelectRun(run.runId)}
								className={cn(
									"w-full rounded-md border p-3 text-left transition",
									"hover:border-blue-500/60",
									targetRunId === run.runId && "border-blue-500 bg-blue-500/5",
								)}
							>
								<div className="flex items-center justify-between gap-2">
									<div className="truncate text-sm font-medium">{run.repo}</div>
									<Badge variant={getStatusBadgeVariant(run.status)}>
										{run.status}
									</Badge>
								</div>
								<p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
									{run.task}
								</p>
								<p className="mt-1 text-xs text-muted-foreground">
									{formatRelativeTime(run.updatedAt)}
								</p>
							</button>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
