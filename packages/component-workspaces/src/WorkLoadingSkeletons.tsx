import {
	Card,
	LoadingRegion,
	PageHeaderSkeleton,
	pageShellContentClassName,
	Skeleton,
	SkeletonCardGrid,
	SkeletonList,
} from "@ngriffin_uk/polychat-component-ui";
import { cn } from "@ngriffin_uk/polychat-component-ui";

export function WorkspaceOverviewSkeleton() {
	return (
		<LoadingRegion label="Loading workspace" className={cn(pageShellContentClassName, "max-w-6xl")}>
			<PageHeaderSkeleton title="Workspace" actionCount={2} />
			<div className="mb-5">
				<h2 className="text-lg font-semibold">Projects</h2>
				<p className="text-sm text-zinc-500">Projects in this workspace.</p>
			</div>
			<SkeletonCardGrid />
		</LoadingRegion>
	);
}

export function WorkspaceMembersSkeleton() {
	return (
		<LoadingRegion label="Loading people" className={cn(pageShellContentClassName, "max-w-5xl")}>
			<PageHeaderSkeleton title="People & access" actionCount={1} />
			<SkeletonList />
		</LoadingRegion>
	);
}

export function ProjectOverviewSkeleton() {
	return (
		<LoadingRegion label="Loading project" className={cn(pageShellContentClassName, "max-w-6xl")}>
			<PageHeaderSkeleton title="Project" actionCount={2} />
			<div className="grid gap-5 lg:grid-cols-[1.45fr_0.75fr]">
				<section>
					<h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
						Recent conversations
					</h2>
					<SkeletonList count={3} />
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
