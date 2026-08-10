import type {
	AssistantActionItem,
	ProjectCapability,
	ProjectCapabilityKind,
} from "@assistant/schemas";

import type { ProjectCapabilityKindGroup } from "~/lib/project-capability-catalog";
import { getProjectCapabilityKind } from "~/lib/project-capability-catalog";
import { ProjectCapabilityCard } from "./ProjectCapabilityCard";

interface ProjectCapabilityGroupsProps {
	canManage: boolean;
	capabilities: ProjectCapability[];
	groups: ProjectCapabilityKindGroup[];
	isAdding: boolean;
	isRemoving: boolean;
	onAdd: (item: AssistantActionItem, kind: ProjectCapabilityKind) => void;
	onRemove: (capability: ProjectCapability) => void;
	projectId: string;
	workspaceId: string;
}

export function ProjectCapabilityGroups({
	canManage,
	capabilities,
	groups,
	isAdding,
	isRemoving,
	onAdd,
	onRemove,
	projectId,
	workspaceId,
}: ProjectCapabilityGroupsProps) {
	return (
		<div className="space-y-10">
			{groups.map((group) => (
				<section key={group.kind} aria-labelledby={`capability-kind-${group.kind}`}>
					<div className="mb-4 flex items-center gap-2">
						<h2 id={`capability-kind-${group.kind}`} className="text-lg font-semibold">
							{group.label}
						</h2>
						<span className="text-xs text-zinc-500">
							{group.categories.reduce((total, item) => total + item.items.length, 0)}
						</span>
					</div>
					<div className="space-y-7">
						{group.categories.map((categoryGroup) => (
							<div key={categoryGroup.category}>
								<h3 className="mb-3 text-sm font-medium text-zinc-600 dark:text-zinc-300">
									{categoryGroup.category}
								</h3>
								<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
									{categoryGroup.items.map((item) => {
										const itemKind = getProjectCapabilityKind(item);
										if (!itemKind) return null;
										const existing = capabilities.find(
											(capability) =>
												capability.kind === itemKind &&
												capability.capabilityId === item.capability.id,
										);

										return (
											<ProjectCapabilityCard
												key={item.id}
												canManage={canManage}
												existing={existing}
												isAdding={isAdding}
												isRemoving={isRemoving}
												item={item}
												kind={itemKind}
												onAdd={() => onAdd(item, itemKind)}
												onRemove={() => existing && onRemove(existing)}
												projectId={projectId}
												workspaceId={workspaceId}
											/>
										);
									})}
								</div>
							</div>
						))}
					</div>
				</section>
			))}
		</div>
	);
}
