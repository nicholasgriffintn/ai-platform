import { ExternalLink, Plus, Puzzle, Trash2, Wrench } from "lucide-react";
import { Link } from "react-router";
import type {
	AssistantActionItem,
	ProjectCapability,
	ProjectCapabilityKind,
} from "@assistant/schemas";

import { Button, Card } from "~/components/ui";

interface ProjectCapabilityCardProps {
	canManage: boolean;
	existing?: ProjectCapability;
	isAdding: boolean;
	isRemoving: boolean;
	item: AssistantActionItem;
	kind: ProjectCapabilityKind;
	onAdd: () => void;
	onRemove: () => void;
	projectId: string;
	workspaceId: string;
}

export function ProjectCapabilityCard({
	canManage,
	existing,
	isAdding,
	isRemoving,
	item,
	kind,
	onAdd,
	onRemove,
	projectId,
	workspaceId,
}: ProjectCapabilityCardProps) {
	return (
		<Card className="justify-between p-5 shadow-none">
			<div>
				<div className="mb-4 flex items-center justify-between">
					<span className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
						{kind === "tool" ? <Wrench size={18} /> : <Puzzle size={18} />}
					</span>
					{existing && (
						<span className="rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
							Enabled
						</span>
					)}
				</div>
				<h4 className="font-semibold">{item.label}</h4>
				<p className="mt-2 min-h-12 text-sm leading-6 text-zinc-500">
					{item.description || item.capability.description}
				</p>
			</div>
			{existing ? (
				<div className="flex gap-2">
					{kind === "app" && (
						<Link
							to={`/work/${workspaceId}/projects/${projectId}/apps/${item.capability.id}`}
							className="flex-1"
						>
							<Button className="w-full" icon={<ExternalLink size={15} />}>
								Open
							</Button>
						</Link>
					)}
					<Button
						variant="outline"
						icon={<Trash2 size={15} />}
						isLoading={isRemoving}
						disabled={!canManage}
						onClick={onRemove}
					>
						Remove
					</Button>
				</div>
			) : (
				<Button
					variant="secondary"
					icon={<Plus size={15} />}
					isLoading={isAdding}
					disabled={!canManage}
					onClick={onAdd}
				>
					Add to project
				</Button>
			)}
		</Card>
	);
}
