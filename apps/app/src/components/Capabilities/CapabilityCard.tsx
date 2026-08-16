import {
	Ellipsis,
	ExternalLink,
	Play,
	Plus,
	Puzzle,
	Settings2,
	Trash2,
	Wrench,
} from "lucide-react";
import { useNavigate } from "react-router";
import type {
	AssistantActionItem,
	CapabilityCatalogItem,
	ProjectCapabilityKind,
	ProjectExperienceDefinition,
	ModelToolDefinition,
} from "@ngriffin_uk/polychat-schemas";

import { Button, Card, DropdownMenu, DropdownMenuItem } from "@ngriffin_uk/polychat-component-ui";
import { getIcon, getIconContainerClass } from "~/components/Apps/utils";
import {
	type CapabilitySurface,
	type EnabledCapability,
	getCapabilityOpenPath,
} from "~/lib/capability-surfaces";

interface CapabilityCardProps {
	app?: CapabilityCatalogItem;
	existing?: EnabledCapability;
	isConfigured?: boolean;
	item: AssistantActionItem;
	kind: ProjectCapabilityKind;
	onConfigure?: () => void;
	projectActions?: {
		canManage: boolean;
		isAdding: boolean;
		isRemoving: boolean;
		onAdd: () => void;
		onRemove: () => void;
	};
	experiences: ProjectExperienceDefinition[];
	tool?: ModelToolDefinition;
	surface: CapabilitySurface;
}

export function CapabilityCard({
	app,
	existing,
	isConfigured,
	item,
	kind,
	onConfigure,
	projectActions,
	experiences,
	tool,
	surface,
}: CapabilityCardProps) {
	const navigate = useNavigate();
	const openPath = getCapabilityOpenPath(item, surface, experiences);
	const appIcon = app ? getIcon(app.icon, app.theme) : null;
	const isRunnableTool = kind === "tool" && Boolean(item.metadata?.toolRunnable);
	const canManage = projectActions?.canManage ?? true;
	const requiresExplicitEnablement = Boolean(projectActions);
	const isIncluded = !requiresExplicitEnablement || Boolean(existing) || Boolean(tool);
	const primaryAction = onConfigure
		? {
				icon: <Settings2 size={15} />,
				label: "Configure",
				onClick: onConfigure,
				requiresManagement: true,
			}
		: openPath
			? {
					icon: isRunnableTool ? <Play size={15} /> : <ExternalLink size={15} />,
					label: isRunnableTool ? "Run" : "Open",
					onClick: () => navigate(openPath),
					requiresManagement: false,
				}
			: null;
	const statusLabel =
		kind === "tool" && tool?.requiresConfiguration
			? isConfigured
				? "Configured"
				: "Configuration required"
			: !requiresExplicitEnablement
				? "Available"
				: kind === "tool"
					? existing
						? "Enabled"
						: "Included"
					: "Enabled";

	return (
		<Card className="justify-between p-5 shadow-none">
			<div>
				<div className="mb-4 flex items-center justify-between">
					<span
						className={`flex h-10 w-10 items-center justify-center rounded-xl ${
							app ? getIconContainerClass(app.theme) : "bg-zinc-100 dark:bg-zinc-800"
						}`}
					>
						{appIcon ? appIcon : kind === "tool" ? <Wrench size={18} /> : <Puzzle size={18} />}
					</span>
					{isIncluded && (
						<span className="rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
							{statusLabel}
						</span>
					)}
				</div>
				<h4 className="font-semibold">{item.label}</h4>
				<p className="mt-2 min-h-12 text-sm leading-6 text-zinc-500">
					{item.description || item.capability.description}
				</p>
			</div>
			{isIncluded ? (
				<div className="flex gap-2">
					{primaryAction && (
						<Button
							className="flex-1"
							variant="primary"
							icon={primaryAction.icon}
							disabled={primaryAction.requiresManagement && !canManage}
							onClick={primaryAction.onClick}
						>
							{primaryAction.label}
						</Button>
					)}
					{existing && projectActions && (kind !== "tool" || !tool) && (
						<DropdownMenu
							position="top"
							buttonProps={{
								"aria-label": "More actions",
								disabled: !canManage || projectActions.isRemoving,
								isLoading: projectActions.isRemoving,
								size: "md",
								variant: "outline",
							}}
							trigger={<Ellipsis size={16} />}
						>
							<DropdownMenuItem
								className="text-red-700 dark:text-red-300"
								icon={<Trash2 size={15} />}
								onClick={projectActions.onRemove}
							>
								{requiresExplicitEnablement ? "Remove from project" : "Remove"}
							</DropdownMenuItem>
						</DropdownMenu>
					)}
				</div>
			) : projectActions ? (
				<Button
					variant="primary"
					icon={<Plus size={15} />}
					isLoading={projectActions.isAdding}
					disabled={!canManage}
					onClick={projectActions.onAdd}
				>
					Add to project
				</Button>
			) : null}
		</Card>
	);
}
