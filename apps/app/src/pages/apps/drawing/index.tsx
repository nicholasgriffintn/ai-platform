import { Brush, Plus } from "lucide-react";
import { useCallback } from "react";
import { Link, useNavigate } from "react-router";

import { BackLink } from "~/components/Core/BackLink";
import { EmptyState } from "~/components/Core/EmptyState";
import { PageHeader } from "~/components/Core/PageHeader";
import { PageShell } from "~/components/Core/PageShell";
import { PageTitle } from "~/components/Core/PageTitle";
import { AppsSidebarContent } from "~/components/Sidebar/AppsSidebarContent";
import { Button, Card } from "~/components/ui";
import { useFetchDrawings } from "~/hooks/useDrawings";
import { cn } from "~/lib/utils";

export function meta() {
	return [
		{ title: "Drawings - Polychat" },
		{
			name: "description",
			content: "Create and transform your drawings into art",
		},
	];
}

export default function DrawingsPage() {
	const navigate = useNavigate();
	const { data: drawings = [], isLoading, error } = useFetchDrawings();

	const handleNewDrawing = useCallback(() => {
		navigate("/apps/drawing/new");
	}, [navigate]);

	return (
		<PageShell
			sidebarContent={<AppsSidebarContent />}
			className="max-w-7xl mx-auto"
			headerContent={
				<div className="flex justify-between items-center">
					<PageHeader>
						<BackLink to="/apps" label="Back to Apps" />
						<PageTitle title="Your Drawings" />
					</PageHeader>
					<Button
						onClick={handleNewDrawing}
						variant="primary"
						icon={<Plus size={16} />}
					>
						New Drawing
					</Button>
				</div>
			}
		>
			{isLoading ? (
				<div className="flex justify-center items-center min-h-[400px]">
					<div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 dark:border-blue-400" />
				</div>
			) : error ? (
				<div className="p-4 bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 rounded-md border border-amber-200 dark:border-amber-800">
					<h3 className="font-semibold mb-2">Failed to load drawings</h3>
					<p>
						{error instanceof Error ? error.message : "Unknown error occurred"}
					</p>
					<Button
						type="button"
						variant="primary"
						onClick={() => window.location.reload()}
						className="mt-4"
					>
						Try Again
					</Button>
				</div>
			) : drawings?.length === 0 ? (
				<EmptyState
					title="No drawings yet"
					message="Create your first drawing to get started."
					action={
						<Button
							onClick={handleNewDrawing}
							variant="primary"
							icon={<Plus size={16} />}
						>
							New Drawing
						</Button>
					}
					className="min-h-[400px]"
				/>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{drawings.map((drawing) => (
						<Link
							key={drawing.id}
							to={`/apps/drawing/${drawing.id}`}
							className="no-underline block focus:outline-none focus:ring-2 focus:ring-blue-500/40 rounded-xl"
						>
							<Card
								className={cn(
									"p-5 h-full",
									"hover:shadow-lg transition-all duration-200 hover:border-zinc-300 dark:hover:border-zinc-600",
								)}
							>
								<div className="relative aspect-video w-full rounded-lg overflow-hidden mb-4 bg-zinc-200 dark:bg-zinc-700">
									{drawing.paintingUrl ? (
										<img
											src={drawing.paintingUrl}
											alt={drawing.description || "Drawing"}
											className="w-full h-full object-cover"
										/>
									) : (
										<div className="flex items-center justify-center h-full">
											<Brush
												size={32}
												className="text-zinc-500 dark:text-zinc-400"
											/>
										</div>
									)}
								</div>
								<h3 className="font-semibold text-lg text-zinc-800 dark:text-zinc-200">
									{drawing.description || "Untitled Drawing"}
								</h3>
								<p className="text-xs text-zinc-500 dark:text-zinc-400">
									Created: {new Date(drawing.createdAt).toLocaleDateString()}
								</p>
							</Card>
						</Link>
					))}
				</div>
			)}
		</PageShell>
	);
}
