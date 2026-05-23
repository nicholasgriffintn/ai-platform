import type { ChangeEvent } from "react";

import { cn } from "~/lib/utils";

interface CompactSelectOption {
	label: string;
	value: string;
}

interface CompactSettingSelectProps {
	description?: string;
	disabled?: boolean;
	id: string;
	label: string;
	onChange: (value: string) => void;
	options: CompactSelectOption[];
	value: string;
}

export function CompactSettingSelect({
	description,
	disabled,
	id,
	label,
	onChange,
	options,
	value,
}: CompactSettingSelectProps) {
	return (
		<div className="space-y-1.5">
			<label htmlFor={id} className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
				{label}
			</label>
			<select
				id={id}
				value={value}
				disabled={disabled}
				onChange={(event) => onChange(event.target.value)}
				className="h-9 w-full rounded-md border border-zinc-200 bg-off-white px-2.5 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500"
			>
				{options.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
			{description && <p className="text-xs text-zinc-500 dark:text-zinc-400">{description}</p>}
		</div>
	);
}

interface CompactSettingNumberProps {
	id: string;
	label: string;
	max?: number;
	min?: number;
	onChange: (value: string) => void;
	value: number | string;
}

export function CompactSettingNumber({
	id,
	label,
	max,
	min,
	onChange,
	value,
}: CompactSettingNumberProps) {
	return (
		<div className="flex items-center justify-between gap-3">
			<label htmlFor={id} className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
				{label}
			</label>
			<input
				id={id}
				type="number"
				min={min}
				max={max}
				value={value}
				onChange={(event) => onChange(event.target.value)}
				className="h-8 w-24 rounded-md border border-zinc-200 bg-off-white px-2 text-right text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500"
			/>
		</div>
	);
}

interface CompactSettingRangeProps {
	id: string;
	label: string;
	markers?: string[];
	max: number;
	min: number;
	onChange: (value: string) => void;
	step: number;
	value: number;
}

export function CompactSettingRange({
	id,
	label,
	markers,
	max,
	min,
	onChange,
	step,
	value,
}: CompactSettingRangeProps) {
	const percentage = ((Number(value) - min) / (max - min)) * 100;

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between gap-3">
				<label htmlFor={id} className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
					{label}
				</label>
				<span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{value}</span>
			</div>
			<div className="relative">
				<input
					id={id}
					type="range"
					min={min}
					max={max}
					step={step}
					value={value}
					onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
					className="h-4 w-full appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-zinc-200 dark:[&::-webkit-slider-runnable-track]:bg-zinc-700 [&::-webkit-slider-thumb]:mt-[-5px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow"
				/>
				<div
					className="pointer-events-none absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-blue-500"
					style={{ width: `${percentage}%` }}
					aria-hidden="true"
				/>
			</div>
			{markers && (
				<div className="flex justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
					{markers.map((marker) => (
						<span key={marker}>{marker}</span>
					))}
				</div>
			)}
		</div>
	);
}

interface CompactSettingSwitchProps {
	checked: boolean;
	id: string;
	label: string;
	onChange: (checked: boolean) => void;
}

export function CompactSettingSwitch({ checked, id, label, onChange }: CompactSettingSwitchProps) {
	return (
		<label
			htmlFor={id}
			className={cn(
				"flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-2 text-sm transition-colors",
				checked
					? "bg-zinc-100 text-zinc-950 dark:bg-zinc-800 dark:text-zinc-50"
					: "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800",
			)}
		>
			<span className="font-medium">{label}</span>
			<input
				id={id}
				type="checkbox"
				checked={checked}
				onChange={(event) => onChange(event.target.checked)}
				className="h-4 w-4 rounded border-zinc-300 text-zinc-700 focus:ring-zinc-500 dark:border-zinc-700 dark:text-zinc-200"
			/>
		</label>
	);
}
