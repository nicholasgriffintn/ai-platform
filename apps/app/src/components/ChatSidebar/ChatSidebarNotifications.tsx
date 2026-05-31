import { Link } from "react-router";

import { useUser } from "~/hooks/useUser";

export function ChatSidebarNotifications({
	isAuthenticated,
	isPro,
	localOnlyMode,
}: {
	isAuthenticated: boolean;
	isPro: boolean;
	localOnlyMode: boolean;
}) {
	const { providerSettings, isLoadingProviderSettings } = useUser({ enabled: isAuthenticated });
	const hasConfiguredProvider = providerSettings.some((provider) => provider.hasApiKey);
	const shouldShowProviderSetup =
		isAuthenticated && !isLoadingProviderSettings && !hasConfiguredProvider;

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

			{shouldShowProviderSetup && (
				<div className="px-3 py-2 text-xs text-zinc-600 dark:text-zinc-300 bg-blue-50 dark:bg-blue-950/30 border-l-2 border-blue-500 mb-2">
					Add provider keys in the{" "}
					<Link
						className="font-medium text-blue-700 dark:text-blue-300"
						to="/profile?tab=providers"
					>
						Providers
					</Link>{" "}
					settings to use your own models without message limits.
				</div>
			)}
		</>
	);
}
