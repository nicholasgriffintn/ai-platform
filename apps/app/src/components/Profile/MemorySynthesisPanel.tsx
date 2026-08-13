import { Brain } from "lucide-react";
import { toast } from "sonner";

import {
	Button,
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@ngriffin_uk/polychat-component-ui";
import { useMemorySynthesis, useTasks } from "~/hooks/useTasks";
import { formatDate } from "@ngriffin_uk/polychat-utility-core";

export function MemorySynthesisPanel() {
	const { synthesis, history, isLoadingSynthesis, isLoadingHistory } = useMemorySynthesis("global");
	const { triggerSynthesisAsync, isTriggeringSynthesis } = useTasks({ shouldRefetch: false });
	const previousSyntheses = history.filter((item) => item.id !== synthesis?.id);

	const generateSynthesis = async () => {
		try {
			await triggerSynthesisAsync({ namespace: "global" });
			toast.success("Memory synthesis queued");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not queue memory synthesis");
		}
	};

	return (
		<Card className="gap-0 py-0 shadow-none">
			<CardHeader className="border-b py-5">
				<div>
					<CardTitle className="flex items-center gap-2">
						<Brain size={18} className="text-zinc-500" />
						Memory synthesis
					</CardTitle>
					<CardDescription className="mt-1">
						A consolidated view of the personal memories Polychat uses in conversations.
					</CardDescription>
				</div>
				<CardAction>
					<Button
						variant="secondary"
						size="sm"
						isLoading={isTriggeringSynthesis}
						onClick={generateSynthesis}
					>
						Generate synthesis
					</Button>
				</CardAction>
			</CardHeader>

			<CardContent className="py-5">
				{isLoadingSynthesis ? (
					<p className="text-sm text-zinc-500">Loading memory synthesis…</p>
				) : synthesis ? (
					<div className="space-y-3">
						<p className="whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-300">
							{synthesis.synthesis_text}
						</p>
						<div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
							{synthesis.synthesis_version ? (
								<span>Version {synthesis.synthesis_version}</span>
							) : null}
							{synthesis.memory_count !== undefined ? (
								<span>{synthesis.memory_count} memories</span>
							) : null}
							<span>Generated {formatDate(synthesis.created_at)}</span>
						</div>
					</div>
				) : (
					<p className="text-sm text-zinc-500">
						No synthesis yet. Generate one after Polychat has saved some memories.
					</p>
				)}

				{!isLoadingHistory && previousSyntheses.length > 0 ? (
					<div className="mt-5 border-t border-zinc-200 pt-5 dark:border-zinc-800">
						<h3 className="mb-3 text-sm font-medium">Previous syntheses</h3>
						<div className="space-y-3">
							{previousSyntheses.map((item) => (
								<div key={item.id} className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
									<p className="whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
										{item.synthesis_text}
									</p>
									<p className="mt-2 text-xs text-zinc-500">
										{item.synthesis_version ? `Version ${item.synthesis_version} · ` : ""}
										{formatDate(item.created_at)}
									</p>
								</div>
							))}
						</div>
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}
