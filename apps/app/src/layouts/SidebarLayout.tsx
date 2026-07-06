import React, { Suspense, lazy } from "react";

import { ChatNavbar } from "~/components/Navbar";
import { useKeyboardShortcuts } from "~/hooks/useKeyboardShortcuts";
import { cn } from "~/lib/utils";
import { useUIStore } from "~/state/stores/uiStore";

const LoginModal = lazy(() =>
	import("~/components/Models/LoginModal").then((mod) => ({
		default: mod.LoginModal,
	})),
);

const KeyboardShortcutsHelp = lazy(() =>
	import("~/components/Models/KeyboardShortcutsHelp").then((mod) => ({
		default: mod.KeyboardShortcutsHelp,
	})),
);

interface SidebarLayoutProps {
	children: React.ReactNode;
	sidebarContent: React.ReactNode;
	showSidebarToggleInNavbar?: boolean;
	displayNavBar?: boolean;
	bgClassName?: string;
}

export function SidebarLayout({
	children,
	sidebarContent,
	showSidebarToggleInNavbar = true,
	displayNavBar = true,
	bgClassName,
}: SidebarLayoutProps) {
	const {
		sidebarVisible,
		showKeyboardShortcuts,
		setShowKeyboardShortcuts,
		showLoginModal,
		setShowLoginModal,
	} = useUIStore();
	useKeyboardShortcuts();

	const handleEnterApiKey = () => {
		setShowLoginModal(true);
	};

	const enhancedSidebarContent = React.isValidElement<{ onEnterApiKey?: () => void }>(
		sidebarContent,
	)
		? React.cloneElement(sidebarContent, {
				onEnterApiKey: handleEnterApiKey,
			})
		: sidebarContent;

	return (
		<>
			<div
				className={cn(
					"flex h-dvh w-full max-w-full overflow-hidden",
					bgClassName ?? "bg-off-white dark:bg-zinc-900",
				)}
			>
				<div className="flex flex-row w-full overflow-hidden relative">
					{sidebarContent && (
						<div className="pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]">
							{enhancedSidebarContent}
						</div>
					)}

					<div className="flex flex-col min-w-0 flex-1 h-full pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pr-[env(safe-area-inset-right)]">
						{displayNavBar && (
							<ChatNavbar showSidebarToggle={showSidebarToggleInNavbar && !sidebarVisible} />
						)}
						<div className="flex-1 overflow-auto w-full">
							{children}
							{showLoginModal && (
								<Suspense fallback={null}>
									<LoginModal
										open={showLoginModal}
										onOpenChange={setShowLoginModal}
										onKeySubmit={() => setShowLoginModal(false)}
									/>
								</Suspense>
							)}
						</div>
					</div>
				</div>
			</div>

			{showKeyboardShortcuts && (
				<Suspense fallback={null}>
					<KeyboardShortcutsHelp
						isOpen={showKeyboardShortcuts}
						onClose={() => setShowKeyboardShortcuts(false)}
					/>
				</Suspense>
			)}
		</>
	);
}
