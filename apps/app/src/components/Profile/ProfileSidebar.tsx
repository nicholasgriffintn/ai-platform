import { Home, Loader2, LogOut } from "lucide-react";
import { Link } from "react-router";

import { AccountNavigation } from "@ngriffin_uk/polychat-component-account";
import { Button } from "@ngriffin_uk/polychat-component-ui";
import { useAuthStatus } from "~/hooks/useAuth";
import { cn } from "~/lib/utils";
import { useUIStore } from "~/state/stores/uiStore";
import { SidebarFooter } from "../Sidebar/SidebarFooter";
import { SidebarHeader } from "../Sidebar/SidebarHeader";
import { ProfileAccountTab } from "./Tabs/ProfileAccountTab";
import { ProfileAgentsTab } from "./Tabs/ProfileAgentsTab";
import { ProfileApiKeysTab } from "./Tabs/ProfileApiKeysTab";
import { ProfileBillingTab } from "./Tabs/ProfileBillingTab";
import { ProfileCustomisationTab } from "./Tabs/ProfileCustomisationTab";
import { ProfileHistoryTab } from "./Tabs/ProfileHistoryTab";
import { ProfilePasskeysTab } from "./Tabs/ProfilePasskeysTab";
import { ProfileProvidersTab } from "./Tabs/ProfileProvidersTab";
import { ProfileTasksTab } from "./Tabs/ProfileTasksTab";
import { ProfileSourcesTab } from "./Tabs/ProfileSourcesTab";
import { ProfileSandboxTab } from "./Tabs/ProfileSandboxTab";

interface ProfileSidebarItem {
	id: string;
	label: string;
	pageTitle?: string;
	component: React.FC;
}

export const profileSidebarItems: ProfileSidebarItem[] = [
	{ id: "account", label: "Account", component: ProfileAccountTab },
	{ id: "passkeys", label: "Passkeys", component: ProfilePasskeysTab },
	{
		id: "customisation",
		label: "Customisation",
		pageTitle: "Customise Chat",
		component: ProfileCustomisationTab,
	},
	{ id: "history", label: "Chat History", component: ProfileHistoryTab },
	{
		id: "providers",
		label: "Providers",
		pageTitle: "Available Providers",
		component: ProfileProvidersTab,
	},
	{ id: "sandbox", label: "Sandbox", component: ProfileSandboxTab },
	{ id: "agents", label: "Agents", component: ProfileAgentsTab },
	{ id: "billing", label: "Billing", component: ProfileBillingTab },
	{ id: "api-keys", label: "API Keys", component: ProfileApiKeysTab },
	{ id: "tasks", label: "Tasks", component: ProfileTasksTab },
	{ id: "sources", label: "Sources", component: ProfileSourcesTab },
];

interface ProfileSidebarProps {
	activeItemId: string;
	onSelectItem: (id: string) => void;
}

export function ProfileSidebar({ activeItemId, onSelectItem }: ProfileSidebarProps) {
	const { sidebarVisible, isMobile, setSidebarVisible } = useUIStore();
	const { isAuthenticated, logout, isLoggingOut } = useAuthStatus();

	return (
		<>
			{sidebarVisible && isMobile && (
				<div
					className="md:hidden fixed inset-0 bg-black/30 z-20"
					onClick={() => setSidebarVisible(false)}
					onKeyDown={(e) => e.key === "Enter" && setSidebarVisible(false)}
					aria-hidden="true"
				/>
			)}
			<div
				className={`fixed md:relative z-50 h-full w-64 bg-off-white dark:bg-zinc-900 transition-transform duration-300 ease-in-out border-r border-zinc-200 dark:border-zinc-800 ${
					sidebarVisible ? "translate-x-0" : "-translate-x-full md:translate-x-0 md:w-0 md:border-0"
				}`}
			>
				{sidebarVisible && (
					<div className="flex flex-col h-full w-64">
						<div className="sticky top-0 bg-off-white dark:bg-zinc-900 border-b border-r border-zinc-200 dark:border-zinc-800 z-10 w-full">
							<SidebarHeader />
						</div>
						<nav className="flex-1 overflow-y-auto overflow-x-hidden p-2 pb-[50px]">
							<ul className="space-y-1">
								<li>
									<Link
										to="/"
										className={cn(
											"block w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ease-in-out",
											"text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900",
											"dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
											"no-underline",
											"flex items-center",
										)}
									>
										<Home className="mr-2 h-5 w-5 flex-shrink-0" />
										<span>Back to Home</span>
									</Link>
								</li>
								<li>
									<AccountNavigation
										sections={profileSidebarItems.map(({ id, label }) => ({ id, label }))}
										activeSectionId={activeItemId}
										onSelect={(section) => onSelectItem(section.id)}
									/>
								</li>
								{isAuthenticated && (
									<li>
										<Button
											type="button"
											variant="destructive"
											onClick={() => logout()}
											disabled={isLoggingOut}
											className="w-full"
											icon={
												isLoggingOut ? (
													<Loader2 className="mr-2 h-5 w-5 animate-spin flex-shrink-0" />
												) : (
													<LogOut className="mr-2 h-5 w-5 flex-shrink-0" />
												)
											}
										>
											<span>Logout</span>
										</Button>
									</li>
								)}
							</ul>
						</nav>
						<div className="sticky bottom-0 border-t border-r border-zinc-200 dark:border-zinc-800 bg-off-white dark:bg-zinc-900 overflow-visible">
							<SidebarFooter />
						</div>
					</div>
				)}
			</div>
		</>
	);
}
