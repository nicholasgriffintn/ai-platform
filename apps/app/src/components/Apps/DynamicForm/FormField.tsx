import type { ChangeEvent, FC } from "react";

import type { AppSchema } from "~/lib/api/dynamic-apps";

type FieldType = AppSchema["formSchema"]["steps"][0]["fields"][0];

interface FormFieldProps {
	field: FieldType;
	value: any;
	onChange: (id: string, value: any) => void;
	error?: string;
}

const FormField: FC<FormFieldProps> = ({ field, value, onChange, error }) => {
	const handleChange = (
		e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
	) => {
		let newValue: any = e.target.value;

		if (field.type === "number") {
			newValue = e.target.value === "" ? "" : Number(e.target.value);
		} else if (field.type === "checkbox") {
			newValue = (e.target as HTMLInputElement).checked;
		}

		onChange(field.id, newValue);
	};

	const handleMultiSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const options = e.target.options;
		const selectedValues: string[] = [];

		for (let i = 0; i < options.length; i++) {
			if (options[i].selected) {
				selectedValues.push(options[i].value);
			}
		}

		onChange(field.id, selectedValues);
	};

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (files && files.length > 0) {
			onChange(field.id, files[0]);
		}
	};

	const renderField = () => {
		switch (field.type) {
			case "text":
				return (
					<input
						type="text"
						id={field.id}
						value={value || ""}
						onChange={handleChange}
						placeholder={field.placeholder}
						className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
						required={field.required}
					/>
				);

			case "textarea":
				return (
					<textarea
						id={field.id}
						value={value || ""}
						onChange={handleChange}
						placeholder={field.placeholder}
						className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 min-h-[100px]"
						required={field.required}
					/>
				);

			case "number":
				return (
					<input
						type="number"
						id={field.id}
						value={value === undefined ? "" : value}
						onChange={handleChange}
						placeholder={field.placeholder}
						min={field.validation?.min}
						max={field.validation?.max}
						className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
						required={field.required}
					/>
				);

			case "select":
				return (
					<select
						id={field.id}
						value={value || ""}
						onChange={handleChange}
						className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
						required={field.required}
					>
						<option value="">Select an option</option>
						{field.validation?.options?.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
				);

			case "multiselect":
				return (
					<select
						id={field.id}
						multiple
						value={value || []}
						onChange={handleMultiSelectChange}
						className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 min-h-[100px]"
						required={field.required}
					>
						{field.validation?.options?.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
				);

			case "checkbox":
				return (
					<div className="flex items-center">
						<input
							type="checkbox"
							id={field.id}
							checked={value || false}
							onChange={handleChange}
							className="h-4 w-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 border-zinc-300 dark:border-zinc-600 rounded"
							required={field.required}
						/>
						<label
							htmlFor={field.id}
							className="ml-2 block text-sm text-zinc-900 dark:text-zinc-100"
						>
							{field.label}
						</label>
					</div>
				);

			case "date":
				return (
					<input
						type="date"
						id={field.id}
						value={value || ""}
						onChange={handleChange}
						className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
						required={field.required}
					/>
				);

			case "file":
				return (
					<input
						type="file"
						id={field.id}
						onChange={handleFileChange}
						className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
						required={field.required}
					/>
				);

			default:
				return <div>Unsupported field type: {field.type}</div>;
		}
	};

	return (
		<div className="mb-4">
			{field.type !== "checkbox" && (
				<label
					htmlFor={field.id}
					className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1"
				>
					{field.label}{" "}
					{field.required && (
						<span className="text-red-500 dark:text-red-400">*</span>
					)}
				</label>
			)}

			{field.description && (
				<p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">
					{field.description}
				</p>
			)}

			{renderField()}

			{error && (
				<p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
			)}
		</div>
	);
};

export default FormField;
