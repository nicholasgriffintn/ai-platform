import { Info } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import type { CanvasInputField } from "~/types/canvas";
import { formatCanvasFieldLabel } from "./utils";

interface CanvasModelOptionControlsProps {
	fields: CanvasInputField[];
	values: Record<string, string | boolean>;
	onChange: (fieldName: string, value: string | boolean) => void;
}

function getFieldTypes(field: CanvasInputField): string[] {
	return Array.isArray(field.type) ? field.type : [field.type];
}

function getFieldHelpText(field: CanvasInputField): string {
	if (field.description) {
		return field.description;
	}

	switch (field.name) {
		case "aspect_ratio":
			return "Controls the output frame shape. Pick a ratio supported by the selected model.";
		case "resolution":
			return "Controls the output resolution. Pick a value supported by the selected model.";
		case "size":
			return "Enter an output size such as 1024x1024, or use the model default.";
		case "output_compression":
			return "Enter a JPEG or WebP compression value from 0 to 100.";
		case "n":
			return "Enter the number of images to request from the model.";
		default:
			break;
	}

	if (field.enum?.length) {
		return "Choose one of the values supported by the selected model.";
	}

	const fieldTypes = getFieldTypes(field);
	if (fieldTypes.includes("integer")) {
		return "Enter a whole number supported by the selected model.";
	}

	if (fieldTypes.includes("number")) {
		return "Enter a number supported by the selected model.";
	}

	if (fieldTypes.includes("boolean")) {
		return "Toggle this option for models that support it.";
	}

	return "Enter a value supported by the selected model, or leave it on the default.";
}

function getFieldPlaceholder(field: CanvasInputField): string {
	const fieldTypes = getFieldTypes(field);
	if (fieldTypes.includes("array")) {
		return "One URL per line";
	}

	switch (field.name) {
		case "size":
			return "e.g. 1024x1024";
		case "output_compression":
			return "0-100";
		case "n":
			return "1";
		default:
			return "Default";
	}
}

function FieldHelp({ field }: { field: CanvasInputField }) {
	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					aria-label={`Help for ${formatCanvasFieldLabel(field.name)}`}
					className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 dark:focus:ring-zinc-600"
				>
					<Info className="h-4 w-4" />
				</button>
			</PopoverTrigger>
			<PopoverContent align="end" side="top" className="w-64 text-sm leading-5">
				{getFieldHelpText(field)}
			</PopoverContent>
		</Popover>
	);
}

function FieldLabel({ field, label }: { field: CanvasInputField; label: string }) {
	return (
		<div className="flex items-center justify-between gap-2">
			<label
				htmlFor={`canvas-option-${field.name}`}
				className="text-sm font-medium leading-5 text-zinc-700 dark:text-zinc-200"
			>
				{label}
			</label>
			<FieldHelp field={field} />
		</div>
	);
}

export function CanvasModelOptionControls({
	fields,
	values,
	onChange,
}: CanvasModelOptionControlsProps) {
	if (fields.length === 0) {
		return null;
	}

	return (
		<div className="space-y-2">
			<label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
				Options
			</label>
			<div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
				{fields.map((field) => {
					const fieldTypes = getFieldTypes(field);
					const label = formatCanvasFieldLabel(field.name);
					const value = values[field.name];

					if (field.enum?.length) {
						return (
							<div
								key={field.name}
								className="space-y-1.5 border-b border-zinc-200 px-3 py-2.5 last:border-b-0 dark:border-zinc-700"
							>
								<FieldLabel field={field} label={label} />
								<select
									id={`canvas-option-${field.name}`}
									value={typeof value === "string" ? value : ""}
									onChange={(event) => onChange(field.name, event.target.value)}
									className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
								>
									<option value="">Default</option>
									{field.enum
										.filter((option): option is string | number =>
											["string", "number"].includes(typeof option),
										)
										.map((option) => (
											<option key={String(option)} value={String(option)}>
												{String(option)}
											</option>
										))}
								</select>
							</div>
						);
					}

					if (fieldTypes.includes("boolean")) {
						return (
							<div
								key={field.name}
								className="flex items-center justify-between gap-3 border-b border-zinc-200 px-3 py-2.5 last:border-b-0 dark:border-zinc-700"
							>
								<div className="flex min-w-0 items-center gap-2">
									<label
										htmlFor={`canvas-option-${field.name}`}
										className="text-sm font-medium leading-5 text-zinc-700 dark:text-zinc-200"
									>
										{label}
									</label>
									<FieldHelp field={field} />
								</div>
								<input
									id={`canvas-option-${field.name}`}
									type="checkbox"
									checked={value === true}
									onChange={(event) => onChange(field.name, event.target.checked)}
									className="h-5 w-5 shrink-0 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-400 dark:border-zinc-600 dark:bg-zinc-950"
								/>
							</div>
						);
					}

					if (fieldTypes.includes("array")) {
						return (
							<div
								key={field.name}
								className="space-y-1.5 border-b border-zinc-200 px-3 py-2.5 last:border-b-0 dark:border-zinc-700"
							>
								<FieldLabel field={field} label={label} />
								<textarea
									id={`canvas-option-${field.name}`}
									value={typeof value === "string" ? value : ""}
									onChange={(event) => onChange(field.name, event.target.value)}
									rows={3}
									className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
									placeholder={getFieldPlaceholder(field)}
								/>
							</div>
						);
					}

					return (
						<div
							key={field.name}
							className="space-y-1.5 border-b border-zinc-200 px-3 py-2.5 last:border-b-0 dark:border-zinc-700"
						>
							<FieldLabel field={field} label={label} />
							<input
								id={`canvas-option-${field.name}`}
								type={
									fieldTypes.includes("integer") || fieldTypes.includes("number")
										? "number"
										: "text"
								}
								value={typeof value === "string" ? value : ""}
								onChange={(event) => onChange(field.name, event.target.value)}
								className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
								placeholder={getFieldPlaceholder(field)}
							/>
						</div>
					);
				})}
			</div>
		</div>
	);
}
