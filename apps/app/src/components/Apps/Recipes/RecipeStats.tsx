import { Card } from "~/components/ui";

interface RecipeStatsProps {
	availableCount: number;
	automationCount: number;
	configuredCount: number;
}

export function RecipeStats({
	availableCount,
	automationCount,
	configuredCount,
}: RecipeStatsProps) {
	return (
		<div className="mb-6 grid gap-3 md:grid-cols-3">
			<Card className="p-4">
				<div className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
					{availableCount}
				</div>
				<div className="text-sm text-zinc-500 dark:text-zinc-400">Available recipes</div>
			</Card>
			<Card className="p-4">
				<div className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
					{automationCount}
				</div>
				<div className="text-sm text-zinc-500 dark:text-zinc-400">Automations</div>
			</Card>
			<Card className="p-4">
				<div className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
					{configuredCount}
				</div>
				<div className="text-sm text-zinc-500 dark:text-zinc-400">Configured</div>
			</Card>
		</div>
	);
}
