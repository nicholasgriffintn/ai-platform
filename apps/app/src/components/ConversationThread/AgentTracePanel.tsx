import { Activity } from "lucide-react";
import { Button, Popover, PopoverContent, PopoverTrigger } from "~/components/ui";
import type { AgentTraceEntry } from "~/lib/agent-trace";
import {
	formatAgentTraceLatency,
	formatAgentTraceUsage,
	getAgentTraceTypeLabel,
} from "~/lib/agent-trace-display";
import { cn } from "~/lib/utils";
import { AgentTraceIcon } from "./AgentTraceIcon";

interface AgentTracePanelProps {
	entries: AgentTraceEntry[];
}

export function AgentTraceButton({ entries }: AgentTracePanelProps) {
	if (entries.length === 0) {
		return null;
	}

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className="flex-shrink-0 text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
					title="View conversation trace"
					aria-label="View conversation trace"
					icon={<Activity className="h-3.5 w-3.5" />}
				>
					<span className="whitespace-nowrap">Trace</span>
				</Button>
			</PopoverTrigger>
			<PopoverContent
				side="bottom"
				align="end"
				sideOffset={8}
				className="max-h-[min(34rem,72dvh)] w-[min(92vw,36rem)] overflow-y-auto rounded-xl p-0"
				aria-label="Conversation trace"
			>
				<AgentTracePanel entries={entries} />
			</PopoverContent>
		</Popover>
	);
}

export function AgentTracePanel({ entries }: AgentTracePanelProps) {
	if (entries.length === 0) {
		return null;
	}

	return (
		<div className="text-xs">
			<div className="flex items-center gap-2 border-b border-zinc-200 px-3 py-2 font-medium text-zinc-700 dark:border-zinc-800 dark:text-zinc-200">
				<Activity className="h-3.5 w-3.5" aria-hidden="true" />
				<span>Trace</span>
				<span className="ml-auto text-zinc-500 dark:text-zinc-400">{entries.length}</span>
			</div>
			<ol className="py-1">
				{entries.map((entry) => {
					const usage = formatAgentTraceUsage(entry);
					const latency = formatAgentTraceLatency(entry);
					return (
						<li
							key={entry.id}
							className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2 px-3 py-1.5 text-zinc-600 dark:text-zinc-300"
						>
							<AgentTraceIcon type={entry.type} />
							<div className="min-w-0">
								<div className="flex min-w-0 items-center gap-2">
									<span className="shrink-0 font-medium text-zinc-700 dark:text-zinc-200">
										{getAgentTraceTypeLabel(entry.type)}
									</span>
									<span className="truncate">{entry.label}</span>
								</div>
								{entry.provider || entry.status ? (
									<div className="truncate text-zinc-500 dark:text-zinc-400">
										{[entry.provider, entry.status].filter(Boolean).join(" · ")}
									</div>
								) : null}
							</div>
							<div
								className={cn(
									"flex shrink-0 items-center gap-2 text-zinc-500 dark:text-zinc-400",
									entry.type === "provider_error" && "text-red-500 dark:text-red-400",
								)}
							>
								{usage ? <span>{usage}</span> : null}
								{latency ? <span>{latency}</span> : null}
							</div>
						</li>
					);
				})}
			</ol>
		</div>
	);
}
