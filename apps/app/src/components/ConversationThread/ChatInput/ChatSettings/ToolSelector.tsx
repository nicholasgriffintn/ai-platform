import { Blocks } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button, Popover, PopoverContent, PopoverTrigger } from "~/components/ui";
import { useTools } from "~/hooks/useTools";
import {
	filterTools,
	getAvailableToolCategories,
	type ToolCategoryFilter,
} from "~/lib/tool-filters";
import { cn } from "~/lib/utils";
import type { Tool } from "~/state/stores/toolsStore";
import { useToolsStore } from "~/state/stores/toolsStore";
import { ToolSelectorFilters } from "./ToolSelectorFilters";

export const ToolSelector = ({ isDisabled = false }: { isDisabled?: boolean }) => {
	const [isOpen, setIsOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [category, setCategory] = useState<ToolCategoryFilter>("all");
	const { data: toolsData, isLoading } = useTools();
	const { selectedTools, toggleTool, resetToDefaults, defaultTools, setDefaultTools } =
		useToolsStore();
	const hasInitialisedDefaultTools = useRef(defaultTools.length > 0);

	const tools = toolsData || [];
	const categories = useMemo(() => getAvailableToolCategories(tools), [tools]);
	const visibleTools = useMemo(
		() =>
			filterTools(tools, {
				category,
				query,
				selectedToolIds: selectedTools,
			}),
		[category, query, selectedTools, tools],
	);

	useEffect(() => {
		if (hasInitialisedDefaultTools.current || tools.length === 0) {
			return;
		}

		hasInitialisedDefaultTools.current = true;
		setDefaultTools(tools);
	}, [setDefaultTools, tools]);

	const handleOpenChange = (nextIsOpen: boolean) => {
		setIsOpen(nextIsOpen);
		if (!nextIsOpen) {
			setQuery("");
			setCategory("all");
		}
	};

	const resetFilters = () => {
		setQuery("");
		setCategory("all");
	};

	return (
		<Popover open={isOpen} onOpenChange={handleOpenChange}>
			<PopoverTrigger asChild>
				<Button
					variant={isOpen ? "iconActive" : "icon"}
					icon={<Blocks className="h-4 w-4" />}
					disabled={isDisabled}
					aria-haspopup="dialog"
					aria-expanded={isOpen}
					title="Manage AI tools"
					aria-label="Manage AI tools"
				>
					<span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-zinc-100 px-1 text-xs dark:bg-zinc-800">
						{selectedTools.length}
					</span>
				</Button>
			</PopoverTrigger>
			<PopoverContent
				side="top"
				align="end"
				sideOffset={10}
				className="w-[min(92vw,28rem)] overflow-hidden rounded-xl p-2"
				aria-label="Manage AI tools"
			>
				<div className="space-y-2">
					<div className="px-3 py-1">
						<div className="text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">
							Tools
						</div>
						<p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
							Choose tools for the next response.
						</p>
					</div>

					{!isLoading && tools.length > 0 && (
						<ToolSelectorFilters
							categories={categories}
							category={category}
							onCategoryChange={setCategory}
							onQueryChange={setQuery}
							query={query}
						/>
					)}

					{isLoading ? (
						<div className="flex justify-center py-4">
							<div
								aria-label="Loading tools"
								className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-transparent dark:border-zinc-400"
								role="status"
							/>
						</div>
					) : visibleTools.length === 0 ? (
						<div className="flex min-h-36 flex-col items-center justify-center px-4 text-center">
							<p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
								No tools match these filters
							</p>
							<p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
								Try another search or browse all categories.
							</p>
							<Button className="mt-3 h-8 px-3 text-xs" onClick={resetFilters} variant="secondary">
								Clear filters
							</Button>
						</div>
					) : (
						<div>
							<p
								aria-live="polite"
								className="px-3 pb-1 text-[11px] text-zinc-500 dark:text-zinc-400"
							>
								{visibleTools.length} {visibleTools.length === 1 ? "tool" : "tools"}
							</p>
							<div className="max-h-[min(22rem,44dvh)] space-y-1 overflow-y-auto pr-1">
								{visibleTools.map((tool: Tool) => (
									<label
										key={tool.id}
										htmlFor={`tool-${tool.id}`}
										className={cn(
											"flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 transition-colors",
											selectedTools.includes(tool.id)
												? "bg-zinc-100 text-zinc-950 dark:bg-zinc-800 dark:text-zinc-50"
												: "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800",
										)}
									>
										<input
											type="checkbox"
											id={`tool-${tool.id}`}
											checked={selectedTools.includes(tool.id)}
											onChange={() => toggleTool(tool.id)}
											disabled={isDisabled}
											className={cn(
												"mt-0.5 h-4 w-4 shrink-0 rounded focus:ring-offset-1",
												"border-zinc-300 dark:border-zinc-700",
												"text-black dark:text-white",
												"focus:ring-zinc-500 dark:focus:ring-zinc-400",
											)}
										/>
										<div className="min-w-0 flex-1">
											<div className="flex min-w-0 items-center gap-2">
												<span className="truncate text-sm font-medium">{tool.name}</span>
												{defaultTools.includes(tool.id) && (
													<span className="inline-flex shrink-0 items-center rounded-full bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
														Default
													</span>
												)}
											</div>
											<p className="mt-0.5 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
												{tool.description}
											</p>
											<span className="mt-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
												{tool.category}
											</span>
										</div>
									</label>
								))}
							</div>
						</div>
					)}

					<div className="flex justify-between border-t border-zinc-200 px-1 pt-2 dark:border-zinc-700">
						<Button
							onClick={resetToDefaults}
							variant="secondary"
							className="h-8 px-3 text-xs"
							disabled={isDisabled}
						>
							Reset to defaults
						</Button>
						<Button
							onClick={() => handleOpenChange(false)}
							variant="primary"
							className="h-8 px-3 text-xs"
						>
							Done
						</Button>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
};
