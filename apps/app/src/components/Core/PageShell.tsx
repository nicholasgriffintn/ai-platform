import type { ReactNode } from "react";

import { NotificationBar } from "~/components/ui/NotificationBar";
import { PageHeader } from "~/components/Core/PageHeader";
import { PageTitle } from "~/components/Core/PageTitle";
import { useResponsiveSidebar } from "~/hooks/useResponsiveSidebar";
import { SidebarLayout } from "~/layouts/SidebarLayout";
import { cn } from "~/lib/utils";

interface PageShellProps {
	title?: string;
	sidebarContent?: ReactNode;
	children: ReactNode;
	className?: string;
	headerContent?: ReactNode;
	fullBleed?: boolean;
	isBeta?: boolean;
	displayNavBar?: boolean;
	bgClassName?: string;
}

export function PageShell({
	title,
	sidebarContent,
	children,
	className,
	headerContent,
	fullBleed = false,
	isBeta = false,
	displayNavBar = true,
	bgClassName,
}: PageShellProps) {
	useResponsiveSidebar();

	const header =
		headerContent ||
		(title && (
			<PageHeader>
				<PageTitle title={title} />
			</PageHeader>
		));

	return (
		<SidebarLayout
			sidebarContent={sidebarContent}
			displayNavBar={displayNavBar}
			bgClassName={bgClassName}
		>
			{isBeta && (
				<NotificationBar
					title="Beta Feature"
					description="Dynamic Apps is currently in beta. Some features may change, not work or be unavailable."
				/>
			)}
			{fullBleed ? (
				<>
					{header}
					{children}
				</>
			) : (
				<div className={cn("container mx-auto px-4 py-8 overflow-y-auto", className)}>
					{header}
					{children}
				</div>
			)}
		</SidebarLayout>
	);
}
