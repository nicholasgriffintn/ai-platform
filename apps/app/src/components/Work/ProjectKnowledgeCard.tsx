import { Brain, Database } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { Button, Card, Checkbox, FormDialog } from "~/components/ui";
import {
	useProjectContextSources,
	useSetProjectContextSources,
	useSources,
} from "~/hooks/useSources";

export function ProjectKnowledgeCard({
	workspaceId,
	projectId,
	canManage,
	embedded = false,
}: {
	workspaceId: string;
	projectId: string;
	canManage: boolean;
	embedded?: boolean;
}) {
	const memories = useSources({ projectId, kind: "memory" });
	const allSources = useSources({ projectId });
	const context = useProjectContextSources(projectId);
	const setContext = useSetProjectContextSources(projectId);
	const [isContextOpen, setIsContextOpen] = useState(false);
	const [selectedContextIds, setSelectedContextIds] = useState<string[]>([]);
	const contextCandidates = (allSources.data ?? []).filter(
		(source) => source.kind !== "memory" && source.status === "available",
	);

	const openContext = () => {
		setSelectedContextIds((context.data ?? []).map((source) => source.id));
		setIsContextOpen(true);
	};

	const content = (
		<>
			<section
				className={`space-y-3 p-5 ${embedded ? "border-t border-zinc-100 dark:border-zinc-800" : ""}`}
			>
				<div className="flex items-start justify-between gap-3">
					<div className="flex items-start gap-3">
						<div className="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
							<Brain size={17} />
						</div>
						<div>
							<h2 className="text-sm font-semibold">Project memory</h2>
							<p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
								Shared facts are recalled when relevant in project conversations.
							</p>
						</div>
					</div>
				</div>
				{memories.data?.length ? (
					<ul className="space-y-1.5 pl-11 text-sm text-zinc-700 dark:text-zinc-300">
						{memories.data.slice(0, 3).map((memory) => (
							<li key={memory.id} className="truncate">
								{memory.title}
							</li>
						))}
					</ul>
				) : (
					<p className="pl-11 text-sm text-zinc-500">No project memories yet.</p>
				)}
			</section>

			<section className="space-y-3 border-t border-zinc-100 p-5 dark:border-zinc-800">
				<div className="flex items-start justify-between gap-3">
					<div className="flex items-start gap-3">
						<div className="rounded-lg bg-cyan-50 p-2 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">
							<Database size={17} />
						</div>
						<div>
							<h2 className="text-sm font-semibold">Conversation context</h2>
							<p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
								Selected sources stay attached across project conversations.
							</p>
						</div>
					</div>
					{canManage ? (
						<Button variant="ghost" size="sm" onClick={openContext}>
							Manage
						</Button>
					) : null}
				</div>
				{context.data?.length ? (
					<ul className="space-y-1.5 pl-11 text-sm text-zinc-700 dark:text-zinc-300">
						{context.data.slice(0, 3).map((source) => (
							<li key={source.id} className="truncate">
								{source.title}
							</li>
						))}
					</ul>
				) : (
					<p className="pl-11 text-sm text-zinc-500">No persistent context selected.</p>
				)}
				<Link
					to={`/work/${workspaceId}/projects/${projectId}/sources`}
					className="ml-11 inline-block text-xs text-zinc-500 underline-offset-4 hover:underline"
				>
					Browse project sources
				</Link>
			</section>
		</>
	);

	return (
		<>
			{embedded ? (
				content
			) : (
				<Card className="gap-0 overflow-hidden py-0 shadow-none">{content}</Card>
			)}

			<FormDialog
				open={isContextOpen}
				onOpenChange={setIsContextOpen}
				title="Manage conversation context"
				description="Choose project sources to attach whenever a project conversation starts."
				submitText="Save context"
				isLoading={setContext.isPending}
				onSubmit={async () => {
					await setContext.mutateAsync(selectedContextIds);
					setIsContextOpen(false);
					toast.success("Project context updated");
				}}
			>
				{contextCandidates.length ? (
					<div className="max-h-72 space-y-2 overflow-y-auto">
						{contextCandidates.map((source) => (
							<label
								key={source.id}
								className="flex items-center gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
							>
								<Checkbox
									checked={selectedContextIds.includes(source.id)}
									onCheckedChange={(checked) =>
										setSelectedContextIds((current) =>
											checked === true
												? [...current, source.id]
												: current.filter((id) => id !== source.id),
										)
									}
								/>
								<span className="min-w-0">
									<span className="block truncate text-sm font-medium">{source.title}</span>
									<span className="block text-xs capitalize text-zinc-500">{source.kind}</span>
								</span>
							</label>
						))}
					</div>
				) : (
					<p className="text-sm text-zinc-500">
						Upload a source in project chat before selecting persistent context.
					</p>
				)}
			</FormDialog>
		</>
	);
}
