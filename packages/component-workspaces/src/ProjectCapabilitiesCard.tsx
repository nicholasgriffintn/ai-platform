import type { ProjectCapability } from "@ngriffin_uk/polychat-schemas";
import { Settings2 } from "lucide-react";

import { Card } from "@ngriffin_uk/polychat-component-ui";

const MAX_VISIBLE_CAPABILITIES = 6;

interface ProjectCapabilitiesCardProps {
	capabilities: ProjectCapability[];
	capabilityCount: number;
	embedded?: boolean;
}

export function ProjectCapabilitiesCard({
	capabilities,
	capabilityCount,
	embedded = false,
}: ProjectCapabilitiesCardProps) {
	const visibleCapabilities = capabilities.slice(0, MAX_VISIBLE_CAPABILITIES);
	const hiddenCapabilityCount = Math.max(0, capabilities.length - visibleCapabilities.length);

	const content = (
		<>
			<div className="flex items-center gap-3">
				<div className="rounded-lg bg-violet-50 p-2 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
					<Settings2 size={17} />
				</div>
				<div>
					<h2 className="text-sm font-semibold">Project capabilities</h2>
					<p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
						Apps, recipes, and tools available to this project.
					</p>
				</div>
			</div>
			<div className="flex flex-wrap items-center gap-2 pl-11">
				<p className="mr-1 shrink-0 text-sm text-zinc-500">{capabilityCount} enabled</p>
				{visibleCapabilities.length > 0 && (
					<>
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
					</>
				)}
			</div>
		</>
	);

	return embedded ? (
		<section className="space-y-4 border-t border-zinc-100 p-5 dark:border-zinc-800">
			{content}
		</section>
	) : (
		<Card className="gap-4 p-5 shadow-none">{content}</Card>
	);
}
