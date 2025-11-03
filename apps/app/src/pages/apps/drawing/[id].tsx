import { ChevronLeft } from "lucide-react";
import { Link, useParams } from "react-router";

import { BackLink } from "~/components/Core/BackLink";
import { PageHeader } from "~/components/Core/PageHeader";
import { PageShell } from "~/components/Core/PageShell";
import { ShareButton } from "~/components/ui/ShareButton";
import { AppsSidebarContent } from "~/components/Sidebar/AppsSidebarContent";
import { Button } from "~/components/ui";
import { useFetchDrawing } from "~/hooks/useDrawings";
import { DrawingView } from "../../../components/Apps/Drawings/View";

export function meta() {
	return [
		{ title: "Drawing Details - Polychat" },
		{ name: "description", content: "View your transformed drawing." },
	];
}

export default function DrawingDetailPage() {
	const { id } = useParams<{ id: string }>();
	const { data: drawing, isLoading, error } = useFetchDrawing(id);

	if (isLoading) {
		return (
			<PageShell
				sidebarContent={<AppsSidebarContent />}
				className="max-w-7xl mx-auto"
			>
				<div className="flex justify-center items-center h-64">
					<div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 dark:border-blue-400" />
				</div>
			</PageShell>
		);
	}

	if (error || !drawing) {
		return (
			<PageShell
				sidebarContent={<AppsSidebarContent />}
				className="max-w-7xl mx-auto"
			>
				<div className="flex flex-col justify-center items-center h-64 space-y-4">
					<p className="text-lg text-zinc-600 dark:text-zinc-400">
						Drawing not found
					</p>
					<Link to="/apps/drawing">
						<Button variant="secondary">
							<ChevronLeft size={16} className="mr-1" />
							Back to Drawings
						</Button>
					</Link>
				</div>
			</PageShell>
		);
	}

	return (
		<PageShell
			sidebarContent={<AppsSidebarContent />}
			className="max-w-7xl mx-auto"
			headerContent={
				<div className="flex justify-between items-center">
					<PageHeader>
						<BackLink to="/apps/drawing" label="Back to Drawings" />
						<h1 className="text-2xl font-bold">
							{drawing.description || "Untitled Drawing"}
						</h1>
					</PageHeader>
					{id && <ShareButton appId={id} />}
				</div>
			}
		>
			<DrawingView drawing={drawing} />
		</PageShell>
	);
}
