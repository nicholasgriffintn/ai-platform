import { useEffect, useRef, useState } from "react";

import { ModelIcon } from "~/components/ModelIcon";
import { useModels } from "~/hooks/useModels";
import { getAvailableModels, getFeaturedModelIds } from "~/lib/models";
import { useChatStore } from "~/state/stores/chatStore";

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
	const { model } = useChatStore();
	const { data: apiModels = {} } = useModels();
	const [isOpen, setIsOpen] = useState(true);
	const [selectedModel, setSelectedModel] = useState<string | null>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);

	const availableModels = getAvailableModels(apiModels);
	const featuredModels = getFeaturedModelIds(availableModels);

	const currentGlobalModel =
		typeof model === "string" ? availableModels[model] : null;

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(event.target as Node)
			) {
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

	const handleModelClick = (modelId: string) => {
		setSelectedModel(modelId);
		setIsOpen(false);
		onModelSelect(modelId);
	};

	return (
		<div ref={dropdownRef} className={`${className}`}>
			{isOpen && (
				<div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg w-48 max-h-64 overflow-y-auto">
					<div className="p-1">
						{currentGlobalModel && (
							<>
								<div className="px-2 py-1 text-xs text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700 mb-1">
									Current Model
								</div>
								<button
									key={currentGlobalModel.id}
									type="button"
									onClick={() => handleModelClick(currentGlobalModel.id)}
									className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 transition-colors ${
										selectedModel === currentGlobalModel.id
											? "bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30"
											: "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
									}`}
								>
									<ModelIcon
										modelName={currentGlobalModel.name || currentGlobalModel.id}
										provider={currentGlobalModel.provider}
										size={14}
									/>
									<span
										className={`truncate text-sm ${selectedModel === currentGlobalModel.id ? "font-medium" : ""}`}
									>
										{currentGlobalModel.name || currentGlobalModel.id}
									</span>
								</button>
								<div className="px-2 py-1 text-xs text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700 mb-1 mt-2">
									Other Models
								</div>
							</>
						)}
						{Object.values(featuredModels)
							.filter(
								(featuredModel) =>
									featuredModel.id !==
									(typeof model === "string" ? model : null),
							)
							.slice(0, 7)
							.map((model) => (
								<button
									key={model.id}
									type="button"
									onClick={() => handleModelClick(model.id)}
									className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 transition-colors ${
										selectedModel === model.id
											? "bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30"
											: "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
									}`}
								>
									<ModelIcon
										modelName={model.name || model.id}
										provider={model.provider}
										size={14}
									/>
									<span
										className={`truncate text-sm ${selectedModel === model.id ? "font-medium" : ""}`}
									>
										{model.name || model.id}
									</span>
								</button>
							))}
					</div>
				</div>
			)}
		</div>
	);
};
