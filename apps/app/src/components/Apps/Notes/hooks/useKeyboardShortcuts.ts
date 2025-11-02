import { useCallback, useEffect } from "react";

interface UseKeyboardShortcutsOptions {
	onSave?: () => void;
	onToggleFullBleed?: () => void;
	isFullBleed?: boolean;
}

export function useKeyboardShortcuts({
	onSave,
	onToggleFullBleed,
	isFullBleed,
}: UseKeyboardShortcutsOptions) {
	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.code === "KeyS") {
				e.preventDefault();
				onSave?.();
			}
			if (e.key === "Escape" && isFullBleed) {
				onToggleFullBleed?.();
			}
		},
		[onSave, onToggleFullBleed, isFullBleed],
	);

	useEffect(() => {
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleKeyDown]);
}
