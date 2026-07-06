import { useEffect, useId, useState } from "react";
import type { ReplicateModel, ReplicateInputField } from "@assistant/schemas";

import { getNumberInputValue, parseNumberInputValue } from "~/lib/number-input";

interface ReplicateModelFormProps {
	model: ReplicateModel;
	onSubmit: (data: Record<string, any>) => void;
	isSubmitting: boolean;
}

export function ReplicateModelForm({ model, onSubmit, isSubmitting }: ReplicateModelFormProps) {
	const [formData, setFormData] = useState<Record<string, any>>({});
	const [errors, setErrors] = useState<Record<string, string>>({});

	useEffect(() => {
		const initialData: Record<string, any> = {};
		model.inputSchema.fields.forEach((field) => {
			if (field.default !== undefined) {
				initialData[field.name] = field.default;
			}
		});
		setFormData(initialData);
	}, [model]);

	const handleChange = (fieldName: string, value: any) => {
		setFormData((prev) => ({ ...prev, [fieldName]: value }));
		setErrors((prev) => {
			const newErrors = { ...prev };
			delete newErrors[fieldName];
			return newErrors;
		});
	};

	const validateForm = (): boolean => {
		const newErrors: Record<string, string> = {};

		model.inputSchema.fields.forEach((field) => {
			if (field.required && isReplicateRequiredValueMissing(formData[field.name])) {
				newErrors[field.name] = `${field.name} is required`;
			}
		});

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		if (!validateForm()) {
			return;
		}

		onSubmit(formData);
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-6">
			{model.inputSchema.fields.map((field) => (
				<FormField
					key={field.name}
					field={field}
					value={formData[field.name]}
					onChange={(value) => handleChange(field.name, value)}
					error={errors[field.name]}
				/>
			))}

			<div className="pt-4">
				<button
					type="submit"
					disabled={isSubmitting}
					className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-400 text-white font-medium rounded-lg transition-colors"
				>
					{isSubmitting ? "Generating..." : "Generate"}
				</button>
			</div>
		</form>
	);
}

function isReplicateRequiredValueMissing(value: unknown): boolean {
	if (value === undefined || value === null) return true;
	if (typeof value === "string") return value.trim().length === 0;
	if (typeof value === "number") return !Number.isFinite(value);
	return !value;
}

interface FormFieldProps {
	field: ReplicateInputField;
	value: any;
	onChange: (value: any) => void;
	error?: string;
}

function FormField({ field, value, onChange, error }: FormFieldProps) {
	const fieldTypes = Array.isArray(field.type) ? field.type : [field.type];
	const isFileField = fieldTypes.includes("file");
	const hasEnum = field.enum && field.enum.length > 0;
	const generatedFieldId = useId();
	const fieldId = `replicate-field-${generatedFieldId}`;
	const descriptionId = field.description ? `${fieldId}-description` : undefined;
	const errorId = error ? `${fieldId}-error` : undefined;
	const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;
	const fieldValue = value ?? "";
	const numberFieldValue = getNumberInputValue(value);

	return (
		<div>
			<label
				htmlFor={fieldId}
				className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
			>
				{field.name}
				{field.required && <span className="text-red-500 ml-1">*</span>}
				{field.required && <span className="sr-only"> (required)</span>}
			</label>

			{field.description && (
				<p id={descriptionId} className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">
					{field.description}
				</p>
			)}

			{hasEnum ? (
				<select
					id={fieldId}
					value={fieldValue}
					onChange={(e) => onChange(e.target.value)}
					required={field.required}
					aria-describedby={describedBy}
					aria-invalid={Boolean(error)}
					className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
				>
					<option value="">Select...</option>
					{field.enum!.map((option) => (
						<option key={String(option)} value={String(option)}>
							{String(option)}
						</option>
					))}
				</select>
			) : fieldTypes.includes("boolean") ? (
				<input
					id={fieldId}
					type="checkbox"
					checked={Boolean(value)}
					onChange={(e) => onChange(e.target.checked)}
					required={field.required}
					aria-describedby={describedBy}
					aria-invalid={Boolean(error)}
					className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-zinc-300 rounded"
				/>
			) : fieldTypes.includes("integer") ? (
				<input
					id={fieldId}
					type="number"
					step="1"
					value={numberFieldValue}
					onChange={(e) => onChange(parseNumberInputValue(e.target.value, { integer: true }))}
					required={field.required}
					aria-describedby={describedBy}
					aria-invalid={Boolean(error)}
					className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			) : fieldTypes.includes("number") ? (
				<input
					id={fieldId}
					type="number"
					step="any"
					value={numberFieldValue}
					onChange={(e) => onChange(parseNumberInputValue(e.target.value))}
					required={field.required}
					aria-describedby={describedBy}
					aria-invalid={Boolean(error)}
					className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			) : isFileField ? (
				<div className="space-y-2">
					<input
						id={fieldId}
						type="url"
						placeholder="Enter file URL..."
						value={fieldValue}
						onChange={(e) => onChange(e.target.value)}
						required={field.required}
						aria-describedby={describedBy}
						aria-invalid={Boolean(error)}
						className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
					<p className="text-xs text-zinc-500 dark:text-zinc-400">
						Provide a publicly accessible URL to the file
					</p>
				</div>
			) : field.name.toLowerCase().includes("prompt") ||
			  field.description?.toLowerCase().includes("description") ? (
				<textarea
					id={fieldId}
					value={fieldValue}
					onChange={(e) => onChange(e.target.value)}
					rows={4}
					required={field.required}
					aria-describedby={describedBy}
					aria-invalid={Boolean(error)}
					className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			) : (
				<input
					id={fieldId}
					type="text"
					value={fieldValue}
					onChange={(e) => onChange(e.target.value)}
					required={field.required}
					aria-describedby={describedBy}
					aria-invalid={Boolean(error)}
					className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			)}

			{error && (
				<p id={errorId} className="mt-1 text-sm text-red-600 dark:text-red-400">
					{error}
				</p>
			)}

			{field.default !== undefined && (value === undefined || value === null || value === "") && (
				<p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
					Default: {String(field.default)}
				</p>
			)}
		</div>
	);
}
