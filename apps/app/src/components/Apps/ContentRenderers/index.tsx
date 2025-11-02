import { ArticleRenderer } from "./ArticleRenderer";
import { DrawingRenderer } from "./DrawingRenderer";
import { PodcastRenderer } from "./PodcastRenderer";

export interface AppDataItem {
	id: string;
	app_id: string;
	item_id: string;
	item_type: string;
	data: any;
	share_id?: string;
	created_at: string;
	updated_at: string;
}

interface AppContentRendererProps {
	item: AppDataItem;
}

/**
 * Universal content renderer that dispatches to the appropriate
 * specialized renderer based on app_id
 */
export const AppContentRenderer = ({ item }: AppContentRendererProps) => {
	if (!item || !item.app_id) {
		return (
			<div className="bg-white dark:bg-zinc-800 p-6 rounded-lg shadow-sm">
				<h2 className="text-xl font-semibold mb-4">Shared Content</h2>
				<p className="text-zinc-600 dark:text-zinc-400">
					This content cannot be displayed properly.
				</p>
			</div>
		);
	}

	switch (item.app_id) {
		case "articles":
			return <ArticleRenderer data={item} />;

		case "drawings":
			return <DrawingRenderer data={item.data} />;

		case "podcasts":
			return <PodcastRenderer data={item.data} />;

		default:
			return (
				<div className="bg-white dark:bg-zinc-800 p-6 rounded-lg shadow-sm">
					<h2 className="text-xl font-semibold mb-4">Shared Content</h2>
					<pre className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-md overflow-auto">
						{JSON.stringify(item.data, null, 2)}
					</pre>
				</div>
			);
	}
};

export { ArticleRenderer, DrawingRenderer, PodcastRenderer };
