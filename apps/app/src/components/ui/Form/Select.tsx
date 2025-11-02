import type { ReactNode, SelectHTMLAttributes } from "react";
import { forwardRef } from "react";

import { cn } from "~/lib/utils";
import { Label } from "../label";

export interface FormSelectOption {
	value: string;
	label: string;
}

export interface FormSelectProps
	extends SelectHTMLAttributes<HTMLSelectElement> {
	label?: string;
	description?: string;
	className?: string;
	options?: FormSelectOption[];
	children?: ReactNode;
	fullWidth?: boolean;
}

export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(
	(
		{
			label,
			description,
			options,
			children,
			className,
			fullWidth = true,
			id,
			...props
		},
		ref,
	) => {
		return (
			<div className={cn("space-y-1", fullWidth && "w-full")}>
				{label && <Label htmlFor={id}>{label}</Label>}
				<select
					ref={ref}
					id={id}
					className={cn(
						"w-full px-3 py-1.5 text-sm rounded-md border border-zinc-200 dark:border-zinc-700 bg-off-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100",
						fullWidth && "w-full",
						className,
					)}
					{...props}
				>
					{options
						? options.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))
						: children}
				</select>
				{description && (
					<p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
						{description}
					</p>
				)}
			</div>
		);
	},
);

FormSelect.displayName = "FormSelect";
