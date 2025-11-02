export function ChatSidebarNotifications({
	isAuthenticated,
	isPro,
	localOnlyMode,
}: {
	isAuthenticated: boolean;
	isPro: boolean;
	localOnlyMode: boolean;
}) {
	return (
		<>
			{!isAuthenticated && (
				<div className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400 bg-off-white-highlight dark:bg-zinc-800 mb-2">
					Chats are only stored on this device while you are not signed in
				</div>
			)}

			{!isPro && isAuthenticated && (
				<div className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400 bg-off-white-highlight dark:bg-zinc-800 mb-2">
					{localOnlyMode
						? "Local-only mode: Chats are only stored on this device"
						: "Free plan: Chats are only stored on this device"}
				</div>
			)}

			{isPro && isAuthenticated && localOnlyMode && (
				<div className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400 bg-off-white-highlight dark:bg-zinc-800 mb-2">
					Local-only mode: Chats are only stored on this device
				</div>
			)}
		</>
	);
}
