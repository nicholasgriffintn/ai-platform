import type { FineTuningModelDefinition } from "@assistant/schemas";

import { Badge, Card, CardContent, CardHeader, CardTitle } from "~/components/ui";

interface ModelCatalogProps {
	models: FineTuningModelDefinition[];
}

export function ModelCatalog({ models }: ModelCatalogProps) {
	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
			{models.map((model) => (
				<Card key={model.id} className="shadow-none">
					<CardHeader>
						<div className="flex items-start justify-between gap-3">
							<div className="space-y-1">
								<CardTitle>{model.name}</CardTitle>
								<p className="text-sm text-zinc-600 dark:text-zinc-400">{model.baseModel}</p>
							</div>
							<Badge variant="outline">{model.provider}</Badge>
						</div>
					</CardHeader>
					<CardContent className="space-y-3">
						{model.description && (
							<p className="text-sm text-zinc-700 dark:text-zinc-300">{model.description}</p>
						)}
						{model.defaultEntryPoint && (
							<div className="text-xs text-zinc-500 dark:text-zinc-400">
								Entry point:{" "}
								<span className="font-mono text-zinc-700 dark:text-zinc-300">
									{model.defaultEntryPoint}
								</span>
							</div>
						)}
						<div className="flex flex-wrap gap-2">
							<Badge variant="secondary">{model.family}</Badge>
							{model.supportedTasks?.map((task) => (
								<Badge key={task} variant="outline">
									{task}
								</Badge>
							))}
						</div>
					</CardContent>
				</Card>
			))}
		</div>
	);
}
