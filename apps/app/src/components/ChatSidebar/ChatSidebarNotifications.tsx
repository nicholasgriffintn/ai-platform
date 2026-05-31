import { X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { useUser } from "~/hooks/useUser";

const PROVIDER_SETUP_NOTICE_DISMISSED_KEY = "polychat:provider-setup-notice-dismissed";

export function ChatSidebarNotifications({
	isAuthenticated,
	isPro,
	localOnlyMode,
}: {
	isAuthenticated: boolean;
	isPro: boolean;
	localOnlyMode: boolean;
}) {
	const [isProviderSetupDismissed, setIsProviderSetupDismissed] = useState(
		() =>
			typeof window !== "undefined" &&
			window.localStorage.getItem(PROVIDER_SETUP_NOTICE_DISMISSED_KEY) === "true",
	);
	const { providerSettings, isLoadingProviderSettings } = useUser({ enabled: isAuthenticated });
	const hasConfiguredProvider = providerSettings.some((provider) => provider.hasApiKey);
	const shouldShowProviderSetup =
		isAuthenticated &&
		!isLoadingProviderSettings &&
		!hasConfiguredProvider &&
		!isProviderSetupDismissed;

	const dismissProviderSetupNotice = () => {
		setIsProviderSetupDismissed(true);
		if (typeof window !== "undefined") {
			window.localStorage.setItem(PROVIDER_SETUP_NOTICE_DISMISSED_KEY, "true");
		}
	};

	return (
		<div className="mb-2">
			{!isAuthenticated && (
				<div className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400 bg-off-white-highlight dark:bg-zinc-800">
					Chats are only stored on this device while you are not signed in
				</div>
			)}

			{!isPro && isAuthenticated && (
				<div className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400 bg-off-white-highlight dark:bg-zinc-800">
					{localOnlyMode
						? "Local-only mode: Chats are only stored on this device"
						: "Free plan: Chats are only stored on this device"}
				</div>
			)}

			{isPro && isAuthenticated && localOnlyMode && (
				<div className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400 bg-off-white-highlight dark:bg-zinc-800">
					Local-only mode: Chats are only stored on this device
				</div>
			)}

			{shouldShowProviderSetup && (
				<div className="relative border-l-2 border-blue-500 bg-blue-50 px-3 py-2 pr-9 text-xs text-zinc-600 dark:bg-blue-950/30 dark:text-zinc-300">
					<p>
						Add provider keys in the{" "}
						<Link
							className="font-medium text-blue-700 dark:text-blue-300"
							to="/profile?tab=providers"
						>
							Providers
						</Link>{" "}
						settings to use your own models without message limits.
					</p>
					<button
						type="button"
						aria-label="Dismiss provider setup notice permanently"
						className="absolute right-2 top-2 rounded p-0.5 text-zinc-500 hover:bg-blue-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-blue-900/40 dark:hover:text-zinc-200"
						onClick={dismissProviderSetupNotice}
					>
						<X size={14} aria-hidden="true" />
					</button>
				</div>
			)}
		</div>
	);
}
