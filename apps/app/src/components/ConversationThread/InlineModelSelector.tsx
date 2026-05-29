import { useEffect, useMemo, useRef, useState } from "react";

import { SearchInput } from "~/components/ui/SearchInput";
import { useConversationModelOptions } from "~/hooks/useConversationModelOptions";
import { cn } from "~/lib/utils";
import { ConversationModelOption } from "./ConversationModelOption";

interface InlineModelSelectorProps {
	onModelSelect: (modelId: string) => void;
	onCancel: () => void;
	className?: string;
}

export const InlineModelSelector = ({
	onModelSelect,
	onCancel,
	className = "",
}: InlineModelSelectorProps) => {
	const [isOpen, setIsOpen] = useState(true);
	const [searchQuery, setSearchQuery] = useState("");
	const dropdownRef = useRef<HTMLDivElement>(null);
	const { currentModel, featuredModels, isLoading, searchModels } = useConversationModelOptions({
		excludeCurrentModel: true,
	});
	const searchResults = useMemo(() => searchModels(searchQuery), [searchModels, searchQuery]);
	const isSearching = searchQuery.trim().length > 0;

	const handleModelClick = (modelId: string) => {
		setIsOpen(false);
		onModelSelect(modelId);
	};

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setIsOpen(false);
				onCancel();
			}
		};

		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setIsOpen(false);
				onCancel();
			}
		};

		if (isOpen) {
			document.addEventListener("mousedown", handleClickOutside);
			document.addEventListener("keydown", handleEscape);
		}

		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
			document.removeEventListener("keydown", handleEscape);
		};
	}, [isOpen, onCancel]);

	return (
		<div ref={dropdownRef} className={cn("w-full", className)}>
			{isOpen && (
				<div className="w-full overflow-hidden rounded-lg bg-white dark:bg-zinc-900">
					<div className="border-b border-zinc-200 p-2 dark:border-zinc-700">
						<SearchInput
							value={searchQuery}
							onChange={setSearchQuery}
							placeholder="Search other models"
							className="[&_input]:py-1.5 [&_input]:text-sm"
							autoFocus
						/>
					</div>
					<div className="max-h-[calc(100vh-10rem)] overflow-y-auto p-2 sm:max-h-80">
						{isLoading && (
							<p className="px-2 py-3 text-sm text-zinc-500 dark:text-zinc-400">
								Loading models...
							</p>
						)}
						{currentModel && (
							<>
								<div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
									Current Model
								</div>
								<ConversationModelOption model={currentModel} onSelect={handleModelClick} />
							</>
						)}
						{isSearching && (
							<div className={currentModel ? "mt-3" : ""}>
								<div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
									Search Results
								</div>
								{searchResults.length > 0 ? (
									searchResults.map((modelItem) => (
										<ConversationModelOption
											key={modelItem.id}
											model={modelItem}
											onSelect={handleModelClick}
										/>
									))
								) : (
									<p className="rounded-md border border-dashed border-zinc-300 px-2 py-3 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
										No matching models.
									</p>
								)}
							</div>
						)}
						{featuredModels.length > 0 && (
							<div className={currentModel || isSearching ? "mt-3" : ""}>
								<div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
									Featured Models
								</div>
								{featuredModels.map((modelItem) => (
									<ConversationModelOption
										key={modelItem.id}
										model={modelItem}
										onSelect={handleModelClick}
									/>
								))}
							</div>
						)}
						{!isLoading && !currentModel && !isSearching && featuredModels.length === 0 && (
							<p className="rounded-md border border-dashed border-zinc-300 px-2 py-3 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
								No branch models are available.
							</p>
						)}
					</div>
				</div>
			)}
		</div>
	);
};
