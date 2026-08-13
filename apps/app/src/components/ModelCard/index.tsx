import { ModelCard as ControlledModelCard } from "@ngriffin_uk/polychat-component-models";
import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { ModelIcon } from "~/components/ModelIcon";

interface ModelCardProps {
	model: ModelConfigItem;
}

export function ModelCard({ model }: ModelCardProps) {
	return (
		<ControlledModelCard
			model={{
				id: model.matchingModel,
				name: model.name || model.matchingModel,
				provider: model.provider,
				description: model.description,
			}}
			renderIcon={() => (
				<ModelIcon mono modelName={model.matchingModel} provider={model.provider} size={40} />
			)}
		/>
	);
}
