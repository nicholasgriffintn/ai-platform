import { Check, Plug } from "lucide-react";
import type { AssistantRecipe } from "@ngriffin_uk/polychat-schemas";

import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@ngriffin_uk/polychat-component-ui";
import { getRecipeIntegrationStatusLabel } from "~/lib/recipes";

type RecipeIntegration = AssistantRecipe["integrations"][number];

export function RecipeConnectionsDialog({
	integrations,
	isConnecting,
	onConnect,
	onOpenChange,
	open,
	recipeTitle,
}: {
	integrations: RecipeIntegration[];
	isConnecting: boolean;
	onConnect: (integration: RecipeIntegration) => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	recipeTitle: string;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
				<DialogTitle>{recipeTitle} connections</DialogTitle>
				<DialogDescription>Manage this recipe’s connections.</DialogDescription>
				<div className="mt-4 divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
					{integrations.map((integration) => {
						const isConnected = integration.connectionStatus === "connected";
						const isUnavailable = integration.connectionStatus === "unconfigured";
						return (
							<div
								key={integration.id}
								className="flex min-h-16 items-center justify-between gap-4 px-4 py-3"
							>
								<div className="min-w-0">
									<p className="truncate text-sm font-medium text-zinc-950 dark:text-zinc-100">
										{integration.name}
									</p>
									<p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
										{getRecipeIntegrationStatusLabel(integration.connectionStatus)}
									</p>
								</div>
								{isConnected ? (
									<span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
										<Check className="size-3.5" /> Connected
									</span>
								) : (
									<Button
										variant="outline"
										size="xs"
										icon={<Plug className="size-3.5" />}
										disabled={isUnavailable || isConnecting}
										onClick={() => onConnect(integration)}
									>
										{isUnavailable ? "Unavailable" : "Connect"}
									</Button>
								)}
							</div>
						);
					})}
				</div>
			</DialogContent>
		</Dialog>
	);
}
