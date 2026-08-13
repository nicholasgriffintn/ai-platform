import { type ReactNode, useCallback, useMemo, useState } from "react";

import { NotificationBar } from "@ngriffin_uk/polychat-component-ui";
import { PageTitle } from "~/components/Core/PageTitle";
import { ProductModeHeader } from "~/components/Core/ProductModeHeader";
import {
	PageShellHeader,
	PageShellHeaderActions,
	PageShellHeaderContext,
	type PageShellHeaderDefinition,
} from "~/components/Core/PageShellHeader";
import { PageShellContent, pageShellContentClassName } from "~/components/Core/PageShellContent";
import { useResponsiveSidebar } from "~/hooks/useResponsiveSidebar";
import { SidebarLayout } from "~/layouts/SidebarLayout";
import { cn } from "~/lib/utils";

interface PageShellProps {
	title?: string;
	sidebarContent?: ReactNode;
	children: ReactNode;
	className?: string;
	headerContent?: ReactNode;
	headerActions?: ReactNode;
	fullBleed?: boolean;
	isBeta?: boolean;
	displayNavBar?: boolean;
	bgClassName?: string;
}

function PageShellRoot({
	title,
	sidebarContent,
	children,
	className,
	headerContent,
	headerActions,
	fullBleed = false,
	isBeta = false,
	displayNavBar,
	bgClassName,
}: PageShellProps) {
	useResponsiveSidebar();
	const [registeredHeaders, setRegisteredHeaders] = useState<
		{
			owner: symbol;
			definition: PageShellHeaderDefinition;
		}[]
	>([]);
	const registeredHeader = registeredHeaders.at(-1);
	const registerHeader = useCallback((owner: symbol, definition: PageShellHeaderDefinition) => {
		setRegisteredHeaders((current) => {
			const existingIndex = current.findIndex((registration) => registration.owner === owner);
			if (existingIndex === -1) return [...current, { owner, definition }];

			return current.map((registration, index) =>
				index === existingIndex ? { owner, definition } : registration,
			);
		});
	}, []);
	const unregisterHeader = useCallback((owner: symbol) => {
		setRegisteredHeaders((current) =>
			current.filter((registration) => registration.owner !== owner),
		);
	}, []);
	const headerContext = useMemo(
		() => ({ register: registerHeader, unregister: unregisterHeader }),
		[registerHeader, unregisterHeader],
	);
	const effectiveTitle = registeredHeader?.definition.title ?? title;
	const effectiveActions = registeredHeader ? (
		<PageShellHeaderActions {...registeredHeader.definition} />
	) : (
		headerActions
	);

	const header =
		headerContent ||
		(effectiveTitle && (
			<ProductModeHeader
				showSidebarToggle={Boolean(sidebarContent)}
				context={
					<div className="min-w-0">
						<PageTitle
							title={effectiveTitle}
							className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200"
						/>
					</div>
				}
				actions={effectiveActions}
			/>
		));
	const shouldDisplayNavBar = displayNavBar ?? !header;

	return (
		<PageShellHeaderContext.Provider value={headerContext}>
			<SidebarLayout
				sidebarContent={sidebarContent}
				displayNavBar={shouldDisplayNavBar}
				bgClassName={bgClassName}
			>
				{isBeta && (
					<NotificationBar
						title="Beta Feature"
						description="Dynamic Apps is currently in beta. Some features may change, not work or be unavailable."
					/>
				)}
				{fullBleed ? (
					<div className="flex h-full min-h-0 flex-col overflow-hidden">
						{header}
						<div className="min-h-0 flex-1">{children}</div>
					</div>
				) : header ? (
					<div className="flex h-full min-h-0 flex-col overflow-hidden">
						{header}
						<div
							data-header-scroll-source
							className={cn(pageShellContentClassName, "flex-1 overflow-y-auto", className)}
						>
							{children}
						</div>
					</div>
				) : (
					<div className={cn(pageShellContentClassName, "overflow-y-auto", className)}>
						{children}
					</div>
				)}
			</SidebarLayout>
		</PageShellHeaderContext.Provider>
	);
}

export const PageShell = Object.assign(PageShellRoot, {
	Content: PageShellContent,
	Header: PageShellHeader,
});
