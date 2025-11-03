import type { FC } from "react";

import { DynamicApps } from "~/components/Apps";
import { PageShell } from "~/components/Core/PageShell";
import { AppsSidebarContent } from "~/components/Sidebar/AppsSidebarContent";

export function meta() {
	return [
		{ title: "Apps - Polychat" },
		{ name: "description", content: "Apps for Polychat" },
	];
}

const DynamicAppsRoute: FC = () => {
	return (
		<PageShell
			sidebarContent={<AppsSidebarContent isHome={true} />}
		>
			<DynamicApps />
		</PageShell>
	);
};

export default DynamicAppsRoute;
