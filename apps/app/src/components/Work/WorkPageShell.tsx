import type { ReactNode } from "react";

import { PageStatus } from "~/components/Core/PageStatus";
import { PageShell } from "~/components/Core/PageShell";
import { ProductModeHeader } from "~/components/Core/ProductModeHeader";
import { SignInEmptyState } from "~/components/Core/SignInEmptyState";
import { useChatStore } from "~/state/stores/chatStore";
import { WorkSidebar } from "./WorkSidebar";

export function WorkPageShell({
	children,
	workspaceId,
	projectId,
}: {
	children: ReactNode;
	workspaceId?: string;
	projectId?: string;
}) {
	const isAuthenticated = useChatStore((state) => state.isAuthenticated);
	const isAuthenticationLoading = useChatStore((state) => state.isAuthenticationLoading);
	const requiresAuthentication = Boolean(workspaceId || projectId);
	const content =
		requiresAuthentication && isAuthenticationLoading ? (
			<PageStatus message="Loading workspace…" className="h-full min-h-[360px]" />
		) : requiresAuthentication && !isAuthenticated ? (
			<SignInEmptyState
				title="Sign in to continue"
				message="Sign in to access this workspace and its projects."
				className="min-h-[360px] border-0 bg-transparent dark:bg-transparent"
			/>
		) : (
			children
		);

	return (
		<PageShell
			sidebarContent={<WorkSidebar workspaceId={workspaceId} projectId={projectId} />}
			fullBleed
			displayNavBar={false}
		>
			<div className="flex h-full min-h-0 flex-col overflow-hidden">
				<ProductModeHeader />
				<div className="min-h-0 flex-1 overflow-y-auto">{content}</div>
			</div>
		</PageShell>
	);
}
