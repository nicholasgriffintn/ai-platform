import { Music4, Plus } from "lucide-react";
import { useCallback } from "react";
import { Link, useNavigate } from "react-router";

import { BackLink } from "~/components/Core/BackLink";
import { EmptyState } from "~/components/Core/EmptyState";
import { PageHeader } from "~/components/Core/PageHeader";
import { PageShell } from "~/components/Core/PageShell";
import { PageTitle } from "~/components/Core/PageTitle";
import { AppsSidebarContent } from "~/components/Sidebar/AppsSidebarContent";
import {
	Alert,
	AlertDescription,
	AlertTitle,
	Badge,
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui";
import { CardSkeleton } from "~/components/ui/skeletons";
import { useStrudelPatterns } from "~/hooks/useStrudel";

export function meta() {
	return [
		{ title: "Strudel Music Patterns - Polychat" },
		{
			name: "description",
			content:
				"Generate, save, and replay Strudel music patterns directly inside Polychat.",
		},
	];
}

export default function StrudelPatternsPage() {
	const navigate = useNavigate();
	const {
		data: patterns = [],
		isLoading,
		error,
		refetch,
		isRefetching,
	} = useStrudelPatterns();

	const handleCreate = useCallback(() => {
		navigate("/apps/strudel/new");
	}, [navigate]);

	const headerContent = (
		<div className="flex flex-wrap items-center justify-between gap-4">
			<PageHeader>
				<BackLink to="/apps" label="Back to Apps" />
				<PageTitle title="Strudel Music Patterns" />
				<p className="text-sm text-muted-foreground">
					Bring Strudel live coding into Polychat with sharable AI-generated
					loops.
				</p>
			</PageHeader>
			<Button
				variant="primary"
				icon={<Plus className="h-4 w-4" />}
				onClick={handleCreate}
			>
				New Pattern
			</Button>
		</div>
	);

	return (
		<PageShell
			sidebarContent={<AppsSidebarContent />}
			className="max-w-7xl mx-auto"
			headerContent={headerContent}
		>
			{isLoading ? (
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
					<CardSkeleton count={6} />
				</div>
			) : error ? (
				<Alert variant="destructive" className="flex flex-col gap-3">
					<AlertTitle>Unable to load your Strudel library</AlertTitle>
					<AlertDescription className="space-y-3">
						<p>
							{error instanceof Error
								? error.message
								: "Unknown error occurred"}
						</p>
						<Button
							variant="primary"
							size="sm"
							onClick={() => refetch()}
							isLoading={isRefetching}
						>
							Try Again
						</Button>
					</AlertDescription>
				</Alert>
			) : patterns.length === 0 ? (
				<EmptyState
					variant="welcome"
					icon={
						<div className="flex h-full w-full items-center justify-center rounded-full bg-blue-600/10 text-blue-600">
							<Music4 className="h-12 w-12" />
						</div>
					}
					title="Compose your first Strudel pattern"
					message="Use our AI generator or start typing live-coding patterns – they stay in sync across devices."
					action={
						<Button
							variant="primary"
							icon={<Plus className="h-4 w-4" />}
							onClick={handleCreate}
						>
							Create a Pattern
						</Button>
					}
					suggestions={[
						{ label: "Generate techno groove", onClick: handleCreate },
						{ label: "Build ambient pad", onClick: handleCreate },
					]}
					className="min-h-[420px]"
				/>
			) : (
				<div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
					{patterns.map((pattern) => (
						<Link
							key={pattern.id}
							to={`/apps/strudel/${pattern.id}`}
							className="no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 rounded-xl"
						>
							<Card className="h-full border-zinc-200/70 transition hover:border-blue-500/60 dark:border-zinc-700/60 dark:hover:border-blue-400/60">
								<CardHeader className="pb-4">
									<div className="flex items-center gap-3">
										<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-300">
											<Music4 className="h-5 w-5" />
										</div>
										<div>
											<CardTitle className="text-base">
												{pattern.name}
											</CardTitle>
											<CardDescription>
												Updated{" "}
												{new Date(pattern.updatedAt).toLocaleDateString()}
											</CardDescription>
										</div>
									</div>
								</CardHeader>
								<CardContent className="space-y-4">
									{pattern.description && (
										<p className="text-sm text-muted-foreground line-clamp-2">
											{pattern.description}
										</p>
									)}

									<pre className="max-h-40 overflow-hidden rounded-lg bg-muted/60 p-3 text-xs font-mono leading-relaxed text-muted-foreground">
										{pattern.code}
									</pre>

									{pattern.tags && pattern.tags.length > 0 && (
										<div className="flex flex-wrap gap-2">
											{pattern.tags.map((tag) => (
												<Badge
													key={tag}
													variant="outline"
													className="text-xs capitalize"
												>
													{tag}
												</Badge>
											))}
										</div>
									)}
								</CardContent>
							</Card>
						</Link>
					))}
				</div>
			)}
		</PageShell>
	);
}
