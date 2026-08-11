import type { ProjectCapability } from "@assistant/schemas";
import { Settings2 } from "lucide-react";

import { Card } from "~/components/ui";

const MAX_VISIBLE_CAPABILITIES = 6;

interface ProjectCapabilitiesCardProps {
	capabilities: ProjectCapability[];
	capabilityCount: number;
}

export function ProjectCapabilitiesCard({
	capabilities,
	capabilityCount,
}: ProjectCapabilitiesCardProps) {
	const visibleCapabilities = capabilities.slice(0, MAX_VISIBLE_CAPABILITIES);
	const hiddenCapabilityCount = Math.max(0, capabilities.length - visibleCapabilities.length);

	return (
		<Card className="p-6 shadow-none">
			<div className="flex items-center gap-2">
				<Settings2 size={20} className="text-zinc-500" />
				<h2 className="text-sm font-semibold">Project capabilities</h2>
			</div>
			<p className="text-sm text-zinc-500">{capabilityCount} enabled</p>
			{visibleCapabilities.length > 0 && (
				<div className="flex flex-wrap gap-2">
					{visibleCapabilities.map((capability) => (
						<span
							key={capability.id}
							title={capability.capabilityId}
							className="max-w-full truncate rounded-full border border-zinc-200 px-2.5 py-1 text-xs dark:border-zinc-700"
						>
							{capability.capabilityId}
						</span>
					))}
					{hiddenCapabilityCount > 0 && (
						<span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
							+{hiddenCapabilityCount} more
						</span>
					)}
				</div>
			)}
		</Card>
	);
}
