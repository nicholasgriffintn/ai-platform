import { Blocks } from "lucide-react";
import { useState } from "react";

import { Button, Popover, PopoverContent, PopoverTrigger } from "~/components/ui";
import { useTools } from "~/hooks/useTools";
import { cn } from "~/lib/utils";
import type { Tool } from "~/state/stores/toolsStore";
import { useToolsStore } from "~/state/stores/toolsStore";

export const ToolSelector = ({ isDisabled = false }: { isDisabled?: boolean }) => {
	const [isOpen, setIsOpen] = useState(false);
	const { data: toolsData, isLoading } = useTools();
	const { selectedTools, toggleTool, resetToDefaults, defaultTools, setDefaultTools } =
		useToolsStore();

	const tools = toolsData || [];

	if (tools.length > 0 && defaultTools.length === 0) {
		setDefaultTools(tools);
	}

	return (
		<Popover open={isOpen} onOpenChange={setIsOpen}>
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
				className="max-h-[min(34rem,72dvh)] w-[min(92vw,24rem)] overflow-y-auto rounded-xl p-2"
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

					{isLoading ? (
						<div className="flex justify-center py-4">
							<div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-transparent dark:border-zinc-400" />
						</div>
					) : (
						<div className="max-h-[min(22rem,48dvh)] space-y-1 overflow-y-auto pr-1">
							{tools.map((tool: Tool) => (
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
									</div>
								</label>
							))}
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
						<Button onClick={() => setIsOpen(false)} variant="primary" className="h-8 px-3 text-xs">
							Done
						</Button>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
};
