import type { InputHTMLAttributes } from "react";
import { forwardRef } from "react";

import { cn } from "~/lib/utils";
import { Label } from "../label";

export interface RangeInputProps extends InputHTMLAttributes<HTMLInputElement> {
	label?: string;
	description?: string;
	min?: number;
	max?: number;
	step?: number;
	displayValue?: boolean;
	markers?: string[];
	className?: string;
}

export const RangeInput = forwardRef<HTMLInputElement, RangeInputProps>(
	(
		{
			label,
			description,
			min = 0,
			max = 1,
			step = 0.1,
			displayValue = true,
			markers,
			className,
			id,
			value,
			...props
		},
		ref,
	) => {
		const percentage = ((Number(value) - min) / (max - min)) * 100;

		return (
			<div className="space-y-1">
				<div className="flex justify-between items-center">
					{label && <Label htmlFor={id}>{label}</Label>}
					{displayValue && (
						<span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
							{value}
						</span>
					)}
				</div>
				<div className="relative mt-2">
					<input
						ref={ref}
						id={id}
						type="range"
						min={min}
						max={max}
						step={step}
						value={value}
						className={cn(
							"w-full appearance-none bg-transparent [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-zinc-200 dark:[&::-webkit-slider-runnable-track]:bg-zinc-700 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-off-white [&::-webkit-slider-thumb]:shadow-md",
							className,
						)}
						aria-valuemin={min}
						aria-valuemax={max}
						aria-valuenow={Number(value)}
						aria-valuetext={`${label}: ${value}`}
						{...props}
					/>
					<div
						className="absolute top-1/2 left-0 h-[2px] -translate-y-1/2 bg-blue-500 pointer-events-none"
						style={{
							width: `${percentage}%`,
						}}
						aria-hidden="true"
					/>
				</div>
				{markers && (
					<div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 mt-1">
						{markers.map((marker) => (
							<span key={`marker-${marker}`}>{marker}</span>
						))}
					</div>
				)}
				{description && (
					<p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
						{description}
					</p>
				)}
			</div>
		);
	},
);

RangeInput.displayName = "RangeInput";
