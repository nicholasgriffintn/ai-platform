import { useEffect, useRef } from "react";

import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/Dialog";

interface KeyboardShortcutsHelpProps {
	isOpen: boolean;
	onClose: () => void;
}

interface Shortcut {
	id: string;
	description: string;
	keys: string[];
}

export const KeyboardShortcutsHelp = ({
	isOpen,
	onClose,
}: KeyboardShortcutsHelpProps) => {
	const previousActiveElement = useRef<Element | null>(null);
	const closeButtonRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (isOpen) {
			previousActiveElement.current = document.activeElement;
			setTimeout(() => {
				closeButtonRef.current?.focus();
			}, 50);
		} else {
			if (
				previousActiveElement.current &&
				"focus" in previousActiveElement.current
			) {
				(previousActiveElement.current as HTMLElement).focus();
			}
		}
	}, [isOpen]);

	if (!isOpen) return null;

	const shortcuts: Shortcut[] = [
		{
			id: "search",
			description: "Search",
			keys: ["⌘", "K"],
		},
		{
			id: "new-chat",
			description: "New Chat",
			keys: ["⌘", "⇧", "O"],
		},
		{
			id: "toggle-sidebar",
			description: "Toggle Sidebar",
			keys: ["⌘", "B"],
		},
		{
			id: "toggle-keyboard-shortcuts",
			description: "Toggle Keyboard Shortcuts",
			keys: ["⌘", "/"],
		},
		{
			id: "toggle-local-only-mode",
			description: "Toggle Local Only Mode",
			keys: ["⌘", "⇧", "L"],
		},
	];

	const KeyComponent = ({ keyValue }: { keyValue: string }) => (
		<div className="flex items-center justify-center bg-zinc-800 border border-zinc-700 rounded w-9 h-9">
			<span className="text-zinc-200">{keyValue}</span>
		</div>
	);

	return (
		<Dialog
			open={isOpen}
			onOpenChange={(open) => !open && onClose()}
			width="840px"
		>
			<DialogContent className="max-h-[90vh]">
				<DialogHeader>
					<DialogTitle>Keyboard Shortcuts</DialogTitle>
					<DialogClose onClick={onClose} />
				</DialogHeader>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
					<div className="space-y-6">
						{shortcuts.slice(0, 4).map((shortcut) => (
							<div
								key={shortcut.id}
								className="flex items-center justify-between py-2"
							>
								<span className="text-zinc-700 dark:text-zinc-300">
									{shortcut.description}
								</span>
								<div className="flex gap-1">
									{shortcut.keys.map((keyValue) => (
										<KeyComponent
											key={`${shortcut.id}-${keyValue}`}
											keyValue={keyValue}
										/>
									))}
								</div>
							</div>
						))}
					</div>
					<div className="space-y-6">
						{shortcuts.slice(4).map((shortcut) => (
							<div
								key={shortcut.id}
								className="flex items-center justify-between py-2"
							>
								<span className="text-zinc-700 dark:text-zinc-300">
									{shortcut.description}
								</span>
								<div className="flex gap-1">
									{shortcut.keys.map((keyValue) => (
										<KeyComponent
											key={`${shortcut.id}-${keyValue}`}
											keyValue={keyValue}
										/>
									))}
								</div>
							</div>
						))}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
};
