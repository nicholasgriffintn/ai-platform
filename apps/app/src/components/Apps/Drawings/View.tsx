import { Download } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "~/components/ui";
import type { Drawing } from "~/types/drawing";

interface DrawingViewProps {
	drawing: Drawing;
}

export function DrawingView({ drawing }: DrawingViewProps) {
	const [activeTab, setActiveTab] = useState<"original" | "transformed">(
		"transformed",
	);

	const handleDownload = useCallback(async (url: string, filename: string) => {
		try {
			const response = await fetch(url);
			const blob = await response.blob();
			const blobUrl = URL.createObjectURL(blob);

			const anchor = document.createElement("a");
			anchor.href = blobUrl;
			anchor.download = filename;
			document.body.appendChild(anchor);
			anchor.click();
			document.body.removeChild(anchor);

			URL.revokeObjectURL(blobUrl);
		} catch (error) {
			console.error("Error downloading image:", error);
		}
	}, []);

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap gap-2 justify-between items-center">
				<div className="flex space-x-2">
					<Button
						variant={activeTab === "transformed" ? "default" : "outline"}
						onClick={() => setActiveTab("transformed")}
						size="sm"
					>
						Transformed
					</Button>
					<Button
						variant={activeTab === "original" ? "default" : "outline"}
						onClick={() => setActiveTab("original")}
						size="sm"
					>
						Original
					</Button>
				</div>

				<Button
					variant="outline"
					size="sm"
					onClick={() =>
						handleDownload(
							activeTab === "transformed"
								? drawing.paintingUrl
								: drawing.drawingUrl,
							`${
								drawing.description || "drawing"
							}-${activeTab}-${drawing.id.substring(0, 6)}.png`,
						)
					}
					icon={<Download size={16} />}
				>
					Download
				</Button>
			</div>

			<div className="relative aspect-video w-full bg-zinc-100 dark:bg-zinc-800 rounded-lg overflow-hidden shadow-md">
				<img
					src={
						activeTab === "transformed"
							? drawing.paintingUrl
							: drawing.drawingUrl
					}
					alt={drawing.description || "Drawing"}
					className="w-full h-full object-contain"
				/>
			</div>

			<div className="bg-white dark:bg-zinc-800 shadow rounded-lg p-5 space-y-4">
				<div>
					<h2 className="text-lg font-semibold">Description</h2>
					<p className="text-zinc-600 dark:text-zinc-400">
						{drawing.description || "No description available"}
					</p>
				</div>

				<div className="grid grid-cols-2 gap-4 text-sm">
					<div>
						<p className="text-zinc-500 dark:text-zinc-400">Created</p>
						<p>
							{new Date(drawing.createdAt).toLocaleString(undefined, {
								dateStyle: "medium",
								timeStyle: "short",
							})}
						</p>
					</div>
					<div>
						<p className="text-zinc-500 dark:text-zinc-400">Last Updated</p>
						<p>
							{new Date(drawing.updatedAt).toLocaleString(undefined, {
								dateStyle: "medium",
								timeStyle: "short",
							})}
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
