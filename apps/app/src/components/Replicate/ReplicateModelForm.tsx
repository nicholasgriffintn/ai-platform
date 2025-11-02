import { useState, useEffect } from "react";
import type { ReplicateModel, ReplicateInputField } from "~/types/replicate";

interface ReplicateModelFormProps {
	model: ReplicateModel;
	onSubmit: (data: Record<string, any>) => void;
	isSubmitting: boolean;
}

export function ReplicateModelForm({
	model,
	onSubmit,
	isSubmitting,
}: ReplicateModelFormProps) {
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
			if (field.required && !formData[field.name]) {
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

	return (
		<div>
			<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
				{field.name}
				{field.required && <span className="text-red-500 ml-1">*</span>}
			</label>

			{field.description && (
				<p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">
					{field.description}
				</p>
			)}

			{hasEnum ? (
				<select
					value={value || ""}
					onChange={(e) => onChange(e.target.value)}
					className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
				>
					<option value="">Select...</option>
					{field.enum!.map((option) => (
						<option key={option} value={option}>
							{option}
						</option>
					))}
				</select>
			) : fieldTypes.includes("boolean") ? (
				<input
					type="checkbox"
					checked={value || false}
					onChange={(e) => onChange(e.target.checked)}
					className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-zinc-300 rounded"
				/>
			) : fieldTypes.includes("integer") ? (
				<input
					type="number"
					step="1"
					value={value || ""}
					onChange={(e) => onChange(parseInt(e.target.value))}
					className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			) : fieldTypes.includes("number") ? (
				<input
					type="number"
					step="any"
					value={value || ""}
					onChange={(e) => onChange(parseFloat(e.target.value))}
					className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			) : isFileField ? (
				<div className="space-y-2">
					<input
						type="url"
						placeholder="Enter file URL..."
						value={value || ""}
						onChange={(e) => onChange(e.target.value)}
						className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
					<p className="text-xs text-zinc-500 dark:text-zinc-400">
						Provide a publicly accessible URL to the file
					</p>
				</div>
			) : field.name.toLowerCase().includes("prompt") ||
			  field.description?.toLowerCase().includes("description") ? (
				<textarea
					value={value || ""}
					onChange={(e) => onChange(e.target.value)}
					rows={4}
					className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			) : (
				<input
					type="text"
					value={value || ""}
					onChange={(e) => onChange(e.target.value)}
					className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			)}

			{error && (
				<p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
			)}

			{field.default !== undefined && !value && (
				<p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
					Default: {String(field.default)}
				</p>
			)}
		</div>
	);
}
