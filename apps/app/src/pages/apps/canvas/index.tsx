import type { FC } from "react";

import { BackLink } from "~/components/Core/BackLink";
import { PageHeader } from "~/components/Core/PageHeader";
import { PageShell } from "~/components/Core/PageShell";
import { PageTitle } from "~/components/Core/PageTitle";
import { AppsSidebarContent } from "~/components/Sidebar/AppsSidebarContent";
import { CanvasStudio } from "~/components/Canvas/CanvasStudio";

export function meta() {
	return [
		{ title: "Canvas - Polychat" },
		{
			name: "description",
			content:
				"Generate images and videos across multiple models with a shared canvas workflow",
		},
	];
}

const CanvasRoute: FC = () => {
	return (
		<PageShell
			sidebarContent={<AppsSidebarContent />}
			className="max-w-[1600px] mx-auto"
			headerContent={
				<PageHeader>
					<BackLink to="/apps" label="Back to Apps" />
					<PageTitle title="Canvas" />
				</PageHeader>
			}
		>
			<CanvasStudio />
		</PageShell>
	);
};

export default CanvasRoute;
