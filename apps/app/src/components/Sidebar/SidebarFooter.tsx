import { useUIStore } from "~/state/stores/uiStore";
import { ChatThemeDropdown } from "./ChatThemeDropdown";
import { MoreOptionsDropdown } from "./MoreOptionsDropdown";
import { UserMenuItem } from "./UserMenuItem";

export function SidebarFooter() {
	const { setShowKeyboardShortcuts } = useUIStore();

	return (
		<div className="bg-zinc-50 dark:bg-zinc-900">
			<div className="m-2 flex justify-between items-center">
				<div>
					<UserMenuItem />
				</div>
				<div className="flex items-center gap-2">
					<ChatThemeDropdown position="top" />
					<MoreOptionsDropdown
						position="top"
						onShowKeyboardShortcuts={() => setShowKeyboardShortcuts(true)}
					/>
				</div>
			</div>
		</div>
	);
}
