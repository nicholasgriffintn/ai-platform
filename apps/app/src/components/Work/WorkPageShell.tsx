import type { ReactNode } from "react";

import { PageShell } from "~/components/Core/PageShell";
import { ProductModeHeader } from "~/components/Core/ProductModeHeader";
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
	return (
		<PageShell
			sidebarContent={<WorkSidebar workspaceId={workspaceId} projectId={projectId} />}
			fullBleed
			displayNavBar={false}
		>
			<div className="flex h-full min-h-0 flex-col overflow-hidden">
				<ProductModeHeader />
				<div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
			</div>
		</PageShell>
	);
}
