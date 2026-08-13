import type { AssistantRecipe, RecipeInstallation } from "@ngriffin_uk/polychat-schemas";

import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@ngriffin_uk/polychat-component-ui";
import { formatRecipeConfigurationSummaryValue } from "~/lib/recipes";

interface RecipeConfigurationSummaryDialogProps {
	recipe: AssistantRecipe | null;
	installation: RecipeInstallation | null;
	onOpenChange: (open: boolean) => void;
}

export function RecipeConfigurationSummaryDialog({
	recipe,
	installation,
	onOpenChange,
}: RecipeConfigurationSummaryDialogProps) {
	const configuration = installation?.configuration ?? {};
	const fieldByKey = new Map(recipe?.configurationFields.map((field) => [field.key, field]));
	const orderedKeys = [
		...(recipe?.configurationFields ?? [])
			.map((field) => field.key)
			.filter((key) => Object.hasOwn(configuration, key)),
		...Object.keys(configuration).filter((key) => !fieldByKey.has(key)),
	];

	return (
		<Dialog open={recipe !== null && installation !== null} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>
						{recipe ? `${recipe.title} configuration` : "Recipe configuration"}
					</DialogTitle>
					<DialogDescription>
						Saved values used whenever this project recipe runs.
					</DialogDescription>
				</DialogHeader>

				{orderedKeys.length ? (
					<dl className="divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
						{orderedKeys.map((key) => (
							<div key={key} className="grid gap-1 px-4 py-3 sm:grid-cols-[130px_minmax(0,1fr)]">
								<dt className="text-xs font-medium text-zinc-500">
									{fieldByKey.get(key)?.label ?? key}
								</dt>
								<dd className="break-words text-sm text-zinc-900 dark:text-zinc-100">
									{formatRecipeConfigurationSummaryValue(configuration[key])}
								</dd>
							</div>
						))}
					</dl>
				) : (
					<p className="rounded-lg border border-dashed border-zinc-200 px-4 py-5 text-sm text-zinc-500 dark:border-zinc-800">
						This recipe has no saved configuration.
					</p>
				)}

				<DialogFooter>
					<Button variant="primary" onClick={() => onOpenChange(false)}>
						Done
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
