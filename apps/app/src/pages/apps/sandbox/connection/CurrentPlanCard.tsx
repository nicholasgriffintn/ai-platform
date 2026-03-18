import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui";
import { formatRelativeTime } from "~/lib/dates";

interface Props {
	latestPlan: { plan: string; updatedAt: string } | null;
	planTasks: string[];
}

export function CurrentPlanCard({ latestPlan, planTasks }: Props) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Current plan</CardTitle>
				<CardDescription>
					Latest plan produced by the agent, including extracted task steps.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3">
				{latestPlan ? (
					<>
						<p className="text-xs text-muted-foreground">
							Updated {formatRelativeTime(latestPlan.updatedAt)}
						</p>
						{planTasks.length > 0 && (
							<div className="space-y-1 text-sm">
								{planTasks.map((planTask, index) => (
									<div key={`${planTask}-${index}`} className="flex gap-2">
										<span className="text-muted-foreground">{index + 1}.</span>
										<span className="break-words">{planTask}</span>
									</div>
								))}
							</div>
						)}
						<pre className="max-h-64 overflow-auto rounded-md border bg-muted/40 p-3 text-xs whitespace-pre-wrap break-words">
							{latestPlan.plan}
						</pre>
					</>
				) : (
					<div className="text-sm text-muted-foreground">
						No plan available yet. It will appear after planning completes.
					</div>
				)}
			</CardContent>
		</Card>
	);
}
