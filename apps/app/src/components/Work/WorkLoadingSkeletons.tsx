import type { ReactNode } from "react";

import { PageShell } from "~/components/Core/PageShell";
import { pageShellContentClassName } from "~/components/Core/PageShellContent";
import { Card, Skeleton } from "~/components/ui";
import { cn } from "~/lib/utils";

function LoadingRegion({
	children,
	className,
	label,
}: {
	children: ReactNode;
	className?: string;
	label: string;
}) {
	return (
		<div role="status" aria-label={label} className={className}>
			{children}
		</div>
	);
}

function HeaderSkeleton({ title, actionCount = 0 }: { title: string; actionCount?: number }) {
	return (
		<>
			<PageShell.Header
				title={title}
				actionContent={
					actionCount > 0 ? (
						<div className="flex shrink-0 gap-2">
							{Array.from({ length: actionCount }, (_, index) => (
								<Skeleton key={index} className="h-8 w-8 sm:w-24" />
							))}
						</div>
					) : undefined
				}
			/>
			<Skeleton className="mb-6 h-4 w-80 max-w-full" />
		</>
	);
}

function CardGridSkeleton({ className, count = 4 }: { className?: string; count?: number }) {
	return (
		<div className={cn("grid gap-4 md:grid-cols-2", className)}>
			{Array.from({ length: count }, (_, index) => (
				<Card key={index} className="gap-4 p-6 shadow-none">
					<div className="flex items-center justify-between">
						<Skeleton className="h-5 w-5" />
						<Skeleton className="h-4 w-4" />
					</div>
					<Skeleton className="h-6 w-2/3" />
					<div className="space-y-2">
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-4/5" />
					</div>
					<div className="flex gap-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
						<Skeleton className="h-3 w-24" />
						<Skeleton className="h-3 w-20" />
					</div>
				</Card>
			))}
		</div>
	);
}

function ListSkeleton({ count = 4 }: { count?: number }) {
	return (
		<Card className="gap-0 overflow-hidden py-0 shadow-none">
			{Array.from({ length: count }, (_, index) => (
				<div
					key={index}
					className="flex items-center gap-4 border-b border-zinc-100 px-5 py-4 last:border-0 dark:border-zinc-800"
				>
					<Skeleton className="h-10 w-10 shrink-0 rounded-full" />
					<div className="min-w-0 flex-1 space-y-2">
						<Skeleton className="h-4 w-40 max-w-full" />
						<Skeleton className="h-3 w-56 max-w-full" />
					</div>
					<Skeleton className="h-7 w-16 rounded-full" />
				</div>
			))}
		</Card>
	);
}

export function WorkCardGridSkeleton({
	count,
	gridClassName,
	label,
}: {
	count?: number;
	gridClassName?: string;
	label: string;
}) {
	return (
		<LoadingRegion label={label}>
			<CardGridSkeleton className={gridClassName} count={count} />
		</LoadingRegion>
	);
}

export function WorkspaceOverviewSkeleton() {
	return (
		<LoadingRegion label="Loading workspace" className={cn(pageShellContentClassName, "max-w-6xl")}>
			<HeaderSkeleton title="Workspace" actionCount={2} />
			<div className="mb-5">
				<h2 className="text-lg font-semibold">Projects</h2>
				<p className="text-sm text-zinc-500">Projects in this workspace.</p>
			</div>
			<CardGridSkeleton />
		</LoadingRegion>
	);
}

export function WorkspaceMembersSkeleton() {
	return (
		<LoadingRegion label="Loading people" className={cn(pageShellContentClassName, "max-w-5xl")}>
			<HeaderSkeleton title="People & access" actionCount={1} />
			<ListSkeleton />
		</LoadingRegion>
	);
}

export function ProjectOverviewSkeleton() {
	return (
		<LoadingRegion label="Loading project" className={cn(pageShellContentClassName, "max-w-6xl")}>
			<HeaderSkeleton title="Project" actionCount={2} />
			<div className="grid gap-5 lg:grid-cols-[1.45fr_0.75fr]">
				<section>
					<h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
						Recent conversations
					</h2>
					<ListSkeleton count={3} />
				</section>
				<aside className="space-y-4">
					{["Project brief", "Project capabilities"].map((title) => (
						<Card key={title} className="gap-3 p-6 shadow-none">
							<h2 className="text-sm font-semibold">{title}</h2>
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-3/4" />
						</Card>
					))}
				</aside>
			</div>
		</LoadingRegion>
	);
}

export function ProjectAppSkeleton() {
	return (
		<LoadingRegion
			label="Loading project app"
			className="mx-auto max-w-5xl px-6 py-10 md:px-10 md:py-14"
		>
			<header className="mb-8 space-y-3">
				<Skeleton className="h-4 w-44" />
				<Skeleton className="h-8 w-64 max-w-full" />
				<Skeleton className="h-4 w-96 max-w-full" />
			</header>
			<Card className="gap-5 p-6 shadow-none">
				{Array.from({ length: 3 }, (_, index) => (
					<div key={index} className="space-y-2">
						<Skeleton className="h-4 w-28" />
						<Skeleton className="h-10 w-full" />
					</div>
				))}
				<Skeleton className="h-10 w-28" />
			</Card>
		</LoadingRegion>
	);
}
