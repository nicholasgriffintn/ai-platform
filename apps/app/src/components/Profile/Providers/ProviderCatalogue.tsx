import { ChevronRight, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export interface ProviderCatalogueItem {
	id: string;
	name: string;
	description?: string;
	category: string;
	connected: boolean;
	connecting?: boolean;
	icon: ReactNode;
	onSelect: () => void;
}

export function ProviderCatalogue({ items }: { items: ProviderCatalogueItem[] }) {
	const groups = new Map<string, ProviderCatalogueItem[]>();
	for (const item of items) {
		groups.set(item.category, [...(groups.get(item.category) ?? []), item]);
	}
	const groupedItems = [...groups.entries()]
		.map(([category, categoryItems]) => ({
			category,
			items: categoryItems.sort((left, right) => left.name.localeCompare(right.name)),
		}))
		.sort((left, right) => left.category.localeCompare(right.category));

	return (
		<div className="space-y-8">
			{groupedItems.map((group) => (
				<section key={group.category}>
					<h2 className="mb-2 text-sm font-semibold text-zinc-950 dark:text-zinc-100">
						{group.category}
					</h2>
					<div className="grid gap-1 lg:grid-cols-2">
						{group.items.map((item) => (
							<div
								key={item.id}
								className="group flex min-w-0 items-center rounded-lg border border-transparent transition-colors hover:border-zinc-200 hover:bg-zinc-50 dark:hover:border-zinc-800 dark:hover:bg-zinc-900/60"
							>
								<button
									type="button"
									className="flex min-w-0 flex-1 items-center gap-3 px-2.5 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500/40"
									onClick={item.onSelect}
								>
									{item.icon}
									<span className="min-w-0 flex-1">
										<span className="flex items-center gap-2 font-medium text-zinc-950 dark:text-zinc-100">
											<span className="truncate">{item.name}</span>
											{item.connecting ? (
												<Loader2
													className="size-3.5 shrink-0 animate-spin text-zinc-400"
													aria-label="Connection in progress"
												/>
											) : item.connected ? (
												<span
													className="size-1.5 shrink-0 rounded-full bg-emerald-500"
													aria-label="Connected"
												/>
											) : null}
										</span>
										{item.description && (
											<span className="mt-0.5 block truncate text-sm text-zinc-500 dark:text-zinc-400">
												{item.description}
											</span>
										)}
									</span>
								</button>
								<ChevronRight className="mr-3 size-4 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5" />
							</div>
						))}
					</div>
				</section>
			))}
		</div>
	);
}
