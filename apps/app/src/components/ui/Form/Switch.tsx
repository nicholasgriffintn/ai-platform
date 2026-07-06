import type { ChangeEvent, InputHTMLAttributes } from "react";
import { forwardRef } from "react";

import { cn } from "~/lib/utils";
import { Label } from "../label";
import { mergeDescribedBy } from "./describedBy";

export interface SwitchProps extends Omit<
	InputHTMLAttributes<HTMLInputElement>,
	"type" | "onChange"
> {
	label?: string;
	description?: string;
	className?: string;
	labelPosition?: "left" | "right";
	checked?: boolean;
	onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
	(
		{
			label,
			description,
			className,
			labelPosition = "left",
			id,
			checked,
			onChange,
			"aria-describedby": ariaDescribedBy,
			...props
		},
		ref,
	) => {
		const descriptionId = description && id ? `${id}-description` : undefined;
		const describedBy = mergeDescribedBy(ariaDescribedBy, descriptionId);

		return (
			<div className="space-y-1">
				<div className="flex items-center justify-between">
					{label && labelPosition === "left" && <Label htmlFor={id}>{label}</Label>}
					<label className={cn("relative inline-flex h-6 w-10 shrink-0", className)}>
						<input
							ref={ref}
							id={id}
							type="checkbox"
							role="switch"
							className="peer sr-only"
							checked={checked}
							onChange={onChange}
							aria-describedby={describedBy}
							{...props}
						/>
						<span
							className={cn(
								"absolute inset-0 rounded-full transition-colors peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-zinc-500 peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-60",
								checked ? "bg-zinc-600 dark:bg-zinc-400" : "bg-zinc-300 dark:bg-zinc-700",
							)}
							aria-hidden="true"
						/>
						<span
							className={cn(
								"absolute left-1 top-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 ease-in-out",
								checked ? "translate-x-4" : "translate-x-0",
							)}
							aria-hidden="true"
						/>
					</label>
					{label && labelPosition === "right" && <Label htmlFor={id}>{label}</Label>}
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

Switch.displayName = "Switch";
