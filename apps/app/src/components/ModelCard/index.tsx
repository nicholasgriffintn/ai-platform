import { ModelIcon } from "~/components/ModelIcon";
import type { ModelConfigItem } from "~/types/models";

interface ModelCardProps {
	model: ModelConfigItem;
}

export function ModelCard({ model }: ModelCardProps) {
	return (
		<div className="rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden">
			<div className="p-4 sm:p-6">
				<div className="flex justify-between items-start">
					<div className="flex items-start gap-5">
						<div className="flex-shrink-0">
							<ModelIcon
								mono={true}
								modelName={model.matchingModel}
								provider={model.provider}
								size={40}
							/>
						</div>
						<div>
							<h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
								{model.name || model.matchingModel}
							</h3>
							<small className="text-zinc-500 dark:text-zinc-400">
								Provider: {model.provider}
							</small>
							<p className="text-sm text-zinc-500 dark:text-zinc-400">
								{model.description}
							</p>
						</div>
					</div>
					<div>
						<div className="text-sm text-zinc-500 dark:text-zinc-400">TODO</div>
					</div>
				</div>
			</div>
		</div>
	);
}
