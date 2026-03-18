import { CheckCircle2, Copy, TerminalSquare } from "lucide-react";

import {
	Alert,
	AlertDescription,
	AlertTitle,
	Badge,
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui";
import { getSandboxPromptStrategyLabel } from "~/lib/sandbox/prompt-strategies";
import type { SandboxRun } from "~/types/sandbox";
import { getStatusBadgeVariant } from "../utils";

import { copyToClipboard, summariseRunResult } from "./helpers";

interface Props {
	selectedRun: SandboxRun | undefined;
	isSelectedRunLoading: boolean;
	targetRunId: string | undefined;
	selectedRunError: unknown;
}

export function RunDetailsCard({
	selectedRun,
	isSelectedRunLoading,
	targetRunId,
	selectedRunError,
}: Props) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Selected run details</CardTitle>
				<CardDescription>
					Review summary, branch, and output from the selected run.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{isSelectedRunLoading && targetRunId ? (
					<div className="text-sm text-muted-foreground">
						Loading run details...
					</div>
				) : selectedRunError ? (
					<Alert variant="destructive">
						<AlertTitle>Unable to load selected run</AlertTitle>
						<AlertDescription>
							{selectedRunError instanceof Error
								? selectedRunError.message
								: "Unknown error"}
						</AlertDescription>
					</Alert>
				) : selectedRun ? (
					<div className="space-y-3 text-sm">
						<div className="flex items-center justify-between gap-2">
							<Badge variant={getStatusBadgeVariant(selectedRun.status)}>
								{selectedRun.status}
							</Badge>
							<span className="text-xs text-muted-foreground">
								Run {selectedRun.runId}
							</span>
						</div>
						<p className="text-muted-foreground">
							{summariseRunResult(selectedRun)}
						</p>
						<p>
							<span className="font-medium">Prompt strategy:</span>{" "}
							{getSandboxPromptStrategyLabel(selectedRun.promptStrategy)}
						</p>
						{typeof selectedRun.timeoutSeconds === "number" && (
							<p>
								<span className="font-medium">Timeout:</span>{" "}
								{selectedRun.timeoutSeconds}s
							</p>
						)}
						{selectedRun.status === "paused" &&
							typeof selectedRun.pauseReason === "string" && (
								<p>
									<span className="font-medium">Pause reason:</span>{" "}
									{selectedRun.pauseReason}
								</p>
							)}
						{selectedRun.status === "cancelled" &&
							typeof selectedRun.cancellationReason === "string" && (
								<p>
									<span className="font-medium">Cancellation reason:</span>{" "}
									{selectedRun.cancellationReason}
								</p>
							)}
						{typeof selectedRun.result?.branchName === "string" && (
							<p>
								<span className="font-medium">Branch:</span>{" "}
								{selectedRun.result.branchName}
							</p>
						)}
						{typeof selectedRun.result?.diff === "string" &&
							selectedRun.result.diff.trim() && (
								<div>
									<div className="mb-1 flex items-center justify-between gap-2">
										<p className="flex items-center gap-2 font-medium">
											<TerminalSquare className="h-4 w-4" />
											Diff
										</p>
										<Button
											variant="ghost"
											size="sm"
											className="h-7 gap-1 text-xs"
											onClick={() =>
												copyToClipboard(
													selectedRun.result?.diff as string,
													"Diff",
												)
											}
										>
											<Copy className="h-3 w-3" />
											Copy
										</Button>
									</div>
									<pre className="max-h-56 overflow-auto rounded-md bg-zinc-900 p-3 text-xs text-zinc-100">
										{selectedRun.result.diff}
									</pre>
								</div>
							)}
						{typeof selectedRun.result?.logs === "string" &&
							selectedRun.result.logs.trim() && (
								<div>
									<div className="mb-1 flex items-center justify-between gap-2">
										<p className="flex items-center gap-2 font-medium">
											<CheckCircle2 className="h-4 w-4" />
											Logs
										</p>
										<Button
											variant="ghost"
											size="sm"
											className="h-7 gap-1 text-xs"
											onClick={() =>
												copyToClipboard(
													selectedRun.result?.logs as string,
													"Logs",
												)
											}
										>
											<Copy className="h-3 w-3" />
											Copy
										</Button>
									</div>
									<pre className="max-h-56 overflow-auto rounded-md bg-zinc-900 p-3 text-xs text-zinc-100">
										{selectedRun.result.logs}
									</pre>
								</div>
							)}
					</div>
				) : (
					<div className="text-sm text-muted-foreground">
						Choose a run to inspect detailed output.
					</div>
				)}
			</CardContent>
		</Card>
	);
}
