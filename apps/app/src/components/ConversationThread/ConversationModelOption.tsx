import { ModelIcon } from "~/components/ModelIcon";
import { Checkbox } from "~/components/ui";
import { getModelDisplayName } from "~/lib/models";
import { cn } from "~/lib/utils";
import type { ModelConfigItem } from "~/types";

interface ConversationModelOptionProps {
	model: ModelConfigItem;
	onSelect: (modelId: string) => void;
	isDisabled?: boolean;
	isSelected?: boolean;
	showCheckbox?: boolean;
}

export function ConversationModelOption({
	model,
	onSelect,
	isDisabled = false,
	isSelected = false,
	showCheckbox = false,
}: ConversationModelOptionProps) {
	const displayName = getModelDisplayName(model);

	const handleSelect = () => {
		if (!isDisabled) {
			onSelect(model.id);
		}
	};

	return (
		<div
			role="button"
			tabIndex={isDisabled ? -1 : 0}
			aria-disabled={isDisabled}
			aria-pressed={showCheckbox ? isSelected : undefined}
			onClick={handleSelect}
			onKeyDown={(event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					handleSelect();
				}
			}}
			className={cn(
				"flex w-full cursor-pointer items-start gap-2.5 rounded-md px-2 py-2 text-left transition-colors",
				isSelected
					? "bg-blue-50 text-blue-950 dark:bg-blue-950/35 dark:text-blue-50"
					: "hover:bg-zinc-100 dark:hover:bg-zinc-800/80",
				isDisabled && "cursor-not-allowed opacity-45 hover:bg-transparent",
			)}
		>
			{showCheckbox && (
				<Checkbox
					checked={isSelected}
					disabled={isDisabled}
					className="mt-0.5"
					tabIndex={-1}
					aria-hidden
				/>
			)}
			<span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center">
				<ModelIcon
					modelName={displayName}
					provider={model.provider}
					url={model.avatarUrl}
					size={18}
				/>
			</span>
			<span className="min-w-0 flex-1">
				<span className="block text-sm font-medium leading-5 text-zinc-900 whitespace-normal break-words dark:text-zinc-100">
					{displayName}
				</span>
				<span className="block text-xs leading-4 text-zinc-500 whitespace-normal break-words dark:text-zinc-400">
					{model.provider}
				</span>
			</span>
		</div>
	);
}
