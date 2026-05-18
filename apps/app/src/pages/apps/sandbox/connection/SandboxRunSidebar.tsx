import { AlertCircle, ArrowLeft, GitBranch, Loader2, MessageSquarePlus } from "lucide-react";
import { Link } from "react-router";

import { Badge, Button, SidebarShell } from "~/components/ui";
import { SidebarFooter } from "~/components/Sidebar/SidebarFooter";
import { SidebarHeader } from "~/components/Sidebar/SidebarHeader";
import { formatRelativeTime } from "~/lib/dates";
import { cn } from "~/lib/utils";
import { useUIStore } from "~/state/stores/uiStore";
import type { SandboxRun } from "~/types/sandbox";
import { getStatusBadgeVariant } from "../utils";

interface SandboxRunSidebarProps {
	installationId: number;
	runs: SandboxRun[];
	isRunsLoading: boolean;
	runsError: unknown;
	targetRunId: string | undefined;
	onSelectRun: (runId: string) => void;
	onNewRun: () => void;
}

export function SandboxRunSidebar({
	installationId,
	runs,
	isRunsLoading,
	runsError,
	targetRunId,
	onSelectRun,
	onNewRun,
}: SandboxRunSidebarProps) {
	const { sidebarVisible, isMobile, setSidebarVisible } = useUIStore();
	const runsByRepo = groupRunsByRepo(runs);

	const handleSelectRun = (runId: string) => {
		onSelectRun(runId);
		if (isMobile) setSidebarVisible(false);
	};

	const handleNewRun = () => {
		onNewRun();
		if (isMobile) setSidebarVisible(false);
	};

	return (
		<SidebarShell
			visible={sidebarVisible}
			isMobile={isMobile}
			onClose={() => setSidebarVisible(false)}
			header={<SidebarHeader showCloudButton={false} />}
			footer={<SidebarFooter />}
		>
			<nav className="p-2 pb-[50px]">
				<div className="space-y-1">
					<Link
						to="/apps/sandbox"
						className="flex items-center rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 no-underline transition-colors hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
					>
						<ArrowLeft className="mr-2 h-4 w-4 flex-shrink-0" />
						Sandbox Worker
					</Link>
					<Button
						type="button"
						variant="primary"
						onClick={handleNewRun}
						className="w-full bg-zinc-900 hover:bg-black dark:bg-zinc-800 dark:hover:bg-zinc-700"
						icon={<MessageSquarePlus size={18} />}
					>
						New Sandbox Chat
					</Button>
				</div>

				<div className="mt-5 px-2">
					<div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
						Installation {installationId}
					</div>
				</div>

				{isRunsLoading ? (
					<div className="mt-4 flex items-center gap-2 px-3 text-sm text-zinc-500 dark:text-zinc-400">
						<Loader2 className="h-4 w-4 animate-spin" />
						Loading runs...
					</div>
				) : runsError ? (
					<div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
						<div className="flex items-center gap-2 font-medium">
							<AlertCircle className="h-4 w-4" />
							Run history failed
						</div>
						<p className="mt-1 text-xs">
							{runsError instanceof Error ? runsError.message : "Unknown error"}
						</p>
					</div>
				) : runs.length === 0 ? (
					<div className="mt-4 px-3 text-sm text-zinc-500 dark:text-zinc-400">No runs yet</div>
				) : (
					<div className="mt-4 space-y-5">
						{runsByRepo.map(([repo, repoRuns]) => (
							<section key={repo}>
								<h3 className="mb-2 flex items-center gap-1 px-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
									<GitBranch className="h-3.5 w-3.5" />
									<span className="truncate">{repo}</span>
								</h3>
								<ul className="space-y-1">
									{repoRuns.map((run) => (
										<li key={run.runId}>
											<button
												type="button"
												onClick={() => handleSelectRun(run.runId)}
												className={cn(
													"w-full rounded-lg px-3 py-2 text-left transition-colors",
													"hover:bg-zinc-200 dark:hover:bg-zinc-800",
													targetRunId === run.runId &&
														"bg-zinc-200 text-zinc-950 dark:bg-zinc-800 dark:text-zinc-50",
												)}
											>
												<div className="flex items-center justify-between gap-2">
													<span className="line-clamp-1 text-sm font-medium">{run.task}</span>
													<Badge
														variant={getStatusBadgeVariant(run.status)}
														className="text-[10px]"
													>
														{run.status}
													</Badge>
												</div>
												<div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
													{formatRelativeTime(run.updatedAt)}
												</div>
											</button>
										</li>
									))}
								</ul>
							</section>
						))}
					</div>
				)}
			</nav>
		</SidebarShell>
	);
}

function groupRunsByRepo(runs: SandboxRun[]): Array<[string, SandboxRun[]]> {
	const grouped = new Map<string, SandboxRun[]>();
	for (const run of runs) {
		const repoRuns = grouped.get(run.repo) ?? [];
		repoRuns.push(run);
		grouped.set(run.repo, repoRuns);
	}
	return Array.from(grouped.entries());
}
