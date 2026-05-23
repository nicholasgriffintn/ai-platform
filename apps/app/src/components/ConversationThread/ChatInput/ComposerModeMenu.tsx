import { MessageCircle } from "lucide-react";
import type { ReactNode } from "react";

import { Button, Popover, PopoverContent, PopoverTrigger } from "~/components/ui";

interface ComposerModeMenuProps {
	isDisabled?: boolean;
	menu?: ReactNode;
	side?: "top" | "bottom";
	align?: "start" | "center" | "end";
	trigger?: ReactNode;
}

export function ComposerModeMenu({
	align = "end",
	isDisabled,
	menu,
	side = "top",
	trigger,
}: ComposerModeMenuProps) {
	if (!menu && !trigger) {
		return null;
	}

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					disabled={isDisabled}
					className="h-8 w-8 shrink-0 rounded-full bg-zinc-100 p-0 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
					title="Open chat mode controls"
					aria-label="Open chat mode controls"
				>
					{trigger ?? <MessageCircle className="h-4 w-4" aria-hidden="true" />}
				</Button>
			</PopoverTrigger>
			<PopoverContent
				side={side}
				align={align}
				sideOffset={10}
				className="max-h-[min(30rem,72dvh)] w-[min(92vw,24rem)] overflow-y-auto overscroll-contain rounded-xl p-2"
			>
				{menu && (
					<div>
						<div className="px-3 pb-1 text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">
							Modes
						</div>
						{menu}
					</div>
				)}
			</PopoverContent>
		</Popover>
	);
}
