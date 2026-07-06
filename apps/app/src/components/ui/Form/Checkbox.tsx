import type { InputHTMLAttributes } from "react";
import { forwardRef } from "react";
import { useId } from "react";

import { cn } from "~/lib/utils";
import { Label } from "../label";
import { mergeDescribedBy } from "./describedBy";

export interface FormCheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
	label?: string;
	description?: string;
	className?: string;
	labelPosition?: "left" | "right";
}

export const FormCheckbox = forwardRef<HTMLInputElement, FormCheckboxProps>(
	(
		{
			label,
			description,
			className,
			labelPosition = "left",
			id,
			"aria-describedby": ariaDescribedBy,
			...props
		},
		ref,
	) => {
		const generatedId = useId();
		const controlId = id ?? generatedId;
		const descriptionId = description ? `${controlId}-description` : undefined;
		const describedBy = mergeDescribedBy(ariaDescribedBy, descriptionId);

		return (
			<div className="space-y-1">
				<div className="flex items-center justify-between">
					{label && labelPosition === "left" && <Label htmlFor={controlId}>{label}</Label>}
					<input
						ref={ref}
						id={controlId}
						type="checkbox"
						className={cn(
							"h-4 w-4 rounded border-zinc-300 text-zinc-600 focus:ring-zinc-500",
							className,
						)}
						aria-describedby={describedBy}
						{...props}
					/>
					{label && labelPosition === "right" && <Label htmlFor={controlId}>{label}</Label>}
				</div>
				{description && (
					<p id={descriptionId} className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
						{description}
					</p>
				)}
			</div>
		);
	},
);

FormCheckbox.displayName = "FormCheckbox";
