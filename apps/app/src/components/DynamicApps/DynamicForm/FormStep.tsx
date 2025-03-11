import type { FC } from "react";

import type { AppSchema } from "../../../lib/api/dynamic-apps";
import FormField from "./FormField";

interface FormStepProps {
	step: AppSchema["formSchema"]["steps"][0];
	formData: Record<string, any>;
	onChange: (id: string, value: any) => void;
	errors: Record<string, string>;
}

const FormStep: FC<FormStepProps> = ({ step, formData, onChange, errors }) => {
	return (
		<div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-6 rounded-lg shadow-sm">
			<h2 className="text-xl font-semibold mb-2 text-zinc-900 dark:text-zinc-50">
				{step.title}
			</h2>

			{step.description && (
				<p className="text-zinc-600 dark:text-zinc-300 mb-6">
					{step.description}
				</p>
			)}

			<div className="space-y-4">
				{step.fields.map((field) => (
					<FormField
						key={field.id}
						field={field}
						value={formData[field.id]}
						onChange={onChange}
						error={errors[field.id]}
					/>
				))}
			</div>
		</div>
	);
};

export default FormStep;
