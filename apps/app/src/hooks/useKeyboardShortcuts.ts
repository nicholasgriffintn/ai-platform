import { useEffect } from "react";

import { useChatStore } from "~/state/stores/chatStore";
import { useUIStore } from "~/state/stores/uiStore";

type ShortcutHandler = (e: KeyboardEvent) => void;

export function useKeyboardShortcuts() {
	const {
		setSidebarVisible,
		sidebarVisible,
		showKeyboardShortcuts,
		setShowKeyboardShortcuts,
	} = useUIStore();
	const {
		clearCurrentConversation,
		setShowSearch,
		localOnlyMode,
		setLocalOnlyMode,
	} = useChatStore();

	useEffect(() => {
		const handlers: Record<string, ShortcutHandler> = {
			k: (e: KeyboardEvent) => {
				if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
					e.preventDefault();
					setShowSearch(true);
				}
			},
			o: (e: KeyboardEvent) => {
				if (
					(e.metaKey || e.ctrlKey) &&
					e.shiftKey &&
					e.key.toLowerCase() === "o"
				) {
					e.preventDefault();
					clearCurrentConversation();
				}
			},
			b: (e: KeyboardEvent) => {
				if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
					e.preventDefault();
					setSidebarVisible(!sidebarVisible);
				}
			},
			"/": (e: KeyboardEvent) => {
				if ((e.metaKey || e.ctrlKey) && e.key === "/") {
					e.preventDefault();
					setShowKeyboardShortcuts(!showKeyboardShortcuts);
				}
			},
			l: (e: KeyboardEvent) => {
				if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "l") {
					e.preventDefault();
					setLocalOnlyMode(!localOnlyMode);
				}
			},
		};
		const handleKeyDown = (e: KeyboardEvent) => {
			const key = e.key.toLowerCase();

			if (
				e.target instanceof HTMLInputElement ||
				e.target instanceof HTMLTextAreaElement ||
				e.target instanceof HTMLSelectElement ||
				(e.target as HTMLElement).isContentEditable
			) {
				return;
			}

			const handler = handlers[key];
			if (handler) {
				handler(e);
			}
		};

		window.addEventListener("keydown", handleKeyDown);

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [
		clearCurrentConversation,
		setSidebarVisible,
		sidebarVisible,
		showKeyboardShortcuts,
		setShowKeyboardShortcuts,
		setShowSearch,
		localOnlyMode,
		setLocalOnlyMode,
	]);

	return {};
}
