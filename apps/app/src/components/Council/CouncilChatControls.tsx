import { defaultCouncilMemberIds, councilMembers, type CouncilMemberId } from "@assistant/schemas";
import { ChevronDown, ChevronRight, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "~/components/ui";
import { Checkbox } from "~/components/ui/Checkbox";
import { cn } from "~/lib/utils";

type CouncilResponseMode = "debate" | "single";

interface CouncilChatControlsProps {
	selectedMemberIds: CouncilMemberId[];
	onSelectedMemberIdsChange: (memberIds: CouncilMemberId[]) => void;
	responseMode: CouncilResponseMode;
	onResponseModeChange: (mode: CouncilResponseMode) => void;
	disabled?: boolean;
	hasConversationMessages?: boolean;
}

export function CouncilChatControls({
	selectedMemberIds,
	onSelectedMemberIdsChange,
	responseMode,
	onResponseModeChange,
	disabled,
	hasConversationMessages = false,
}: CouncilChatControlsProps) {
	const selected = useMemo(() => new Set(selectedMemberIds), [selectedMemberIds]);
	const [isExpanded, setIsExpanded] = useState(false);

	useEffect(() => {
		if (hasConversationMessages) {
			setIsExpanded(false);
		}
	}, [hasConversationMessages]);

	const toggleMember = (memberId: CouncilMemberId, checked: boolean) => {
		if (checked) {
			onSelectedMemberIdsChange([...selectedMemberIds, memberId]);
			return;
		}

		const next = selectedMemberIds.filter((id) => id !== memberId);
		onSelectedMemberIdsChange(next.length ? next : [memberId]);
	};

	const selectAll = () => onSelectedMemberIdsChange([...defaultCouncilMemberIds]);

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between gap-3">
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={() => setIsExpanded((value) => !value)}
					className="min-w-0 justify-start gap-2 px-1 text-zinc-800 dark:text-zinc-200"
					aria-expanded={isExpanded}
				>
					{isExpanded ? (
						<ChevronDown className="h-4 w-4 shrink-0" />
					) : (
						<ChevronRight className="h-4 w-4 shrink-0" />
					)}
					<UsersRound className="h-4 w-4 shrink-0" />
					<span>Council</span>
					<span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
						{selectedMemberIds.length}/{councilMembers.length}
					</span>
				</Button>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={selectAll}
						disabled={disabled || selectedMemberIds.length === councilMembers.length}
						className="text-xs font-medium text-zinc-600 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-300"
					>
						All
					</button>
				</div>
			</div>
			{isExpanded && (
				<>
					<div className="grid grid-cols-2 gap-1 rounded-md border border-zinc-200 p-1 dark:border-zinc-700">
						{(["debate", "single"] as const).map((mode) => (
							<button
								key={mode}
								type="button"
								onClick={() => onResponseModeChange(mode)}
								disabled={disabled}
								className={cn(
									"rounded px-2 py-1 text-xs font-medium capitalize transition-colors disabled:cursor-not-allowed disabled:opacity-60",
									responseMode === mode
										? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
										: "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
								)}
							>
								{mode === "debate" ? "Chamber" : "Single"}
							</button>
						))}
					</div>
					<div className="grid max-h-28 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:max-h-36 sm:grid-cols-2">
						{councilMembers.map((member) => {
							const isSelected = selected.has(member.id);
							return (
								<label
									key={member.id}
									className={cn(
										"flex cursor-pointer items-start gap-2 rounded-md border border-zinc-200 p-2 text-left transition-colors dark:border-zinc-700",
										isSelected
											? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
											: "bg-transparent text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900",
										disabled && "cursor-not-allowed opacity-60",
									)}
								>
									<Checkbox
										checked={isSelected}
										disabled={disabled}
										onCheckedChange={(checked) => toggleMember(member.id, checked === true)}
										className="mt-0.5"
									/>
									<span className="min-w-0">
										<span className="block text-sm font-medium leading-5">{member.name}</span>
										<span className="block text-xs leading-4 text-zinc-500 dark:text-zinc-400">
											{member.role}
										</span>
									</span>
								</label>
							);
						})}
					</div>
				</>
			)}
		</div>
	);
}
