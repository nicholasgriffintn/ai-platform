import type { ReactNode } from "react";
import "./styles.css";

export interface ModelSummary {
	id: string;
	name: string;
	provider: string;
	description?: string;
	disabledReason?: string;
}

export interface ModelCardProps {
	model: ModelSummary;
	selected?: boolean;
	renderIcon?: (model: ModelSummary) => ReactNode;
	onSelect?: (model: ModelSummary) => void;
}

export function ModelCard({ model, selected = false, renderIcon, onSelect }: ModelCardProps) {
	const content = (
		<>
			{renderIcon && <span className="polychat-model-icon">{renderIcon(model)}</span>}
			<span className="polychat-model-copy">
				<strong>{model.name || model.id}</strong>
				<small>Provider: {model.provider}</small>
				{model.description && <span>{model.description}</span>}
				{model.disabledReason && <em>{model.disabledReason}</em>}
			</span>
		</>
	);

	return onSelect ? (
		<button
			type="button"
			className="polychat-model-card"
			aria-pressed={selected}
			disabled={Boolean(model.disabledReason)}
			onClick={() => onSelect(model)}
		>
			{content}
		</button>
	) : (
		<article className="polychat-model-card" data-selected={selected || undefined}>
			{content}
		</article>
	);
}

export interface ModelPickerProps {
	models: ModelSummary[];
	selectedModelId?: string;
	emptyMessage?: string;
	renderIcon?: (model: ModelSummary) => ReactNode;
	onSelect: (model: ModelSummary) => void;
}

export function ModelPicker({
	models,
	selectedModelId,
	emptyMessage = "No models available.",
	renderIcon,
	onSelect,
}: ModelPickerProps) {
	if (models.length === 0) return <p className="polychat-model-empty">{emptyMessage}</p>;
	return (
		<div className="polychat-model-picker" role="listbox" aria-label="Models">
			{models.map((model) => (
				<ModelCard
					key={model.id}
					model={model}
					selected={model.id === selectedModelId}
					renderIcon={renderIcon}
					onSelect={onSelect}
				/>
			))}
		</div>
	);
}
