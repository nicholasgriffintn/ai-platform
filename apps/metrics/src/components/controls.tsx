import type { FormEvent } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./ui/select";

interface MetricsParams {
	status: string;
	limit: number;
	interval: number;
	timeframe: number;
}

interface MetricsControlsProps {
	initialValues: MetricsParams;
	onSubmit: (filters: MetricsParams) => void;
}

export function MetricsControls({
	initialValues,
	onSubmit,
}: MetricsControlsProps) {
	const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);

		onSubmit({
			status: formData.get("status") as string,
			limit: Number(formData.get("limit")),
			interval: Number(formData.get("interval")),
			timeframe: Number(formData.get("timeframe")),
		});
	};

	return (
		<form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4">
			<div className="w-full sm:w-[180px]">
				<Label htmlFor="status">Status</Label>
				<Select name="status" defaultValue={initialValues.status}>
					<SelectTrigger id="status">
						<SelectValue placeholder="Select status" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="success">Success</SelectItem>
						<SelectItem value="error">Error</SelectItem>
					</SelectContent>
				</Select>
			</div>
			<div className="w-[calc(50%-0.5rem)] sm:w-[100px]">
				<Label htmlFor="limit">Limit</Label>
				<Input
					name="limit"
					type="number"
					defaultValue={initialValues.limit}
					min={1}
					max={1000}
					className="w-full"
				/>
			</div>
			<div className="w-[calc(50%-0.5rem)] sm:w-[100px]">
				<Label htmlFor="interval">Interval</Label>
				<Input
					name="interval"
					type="number"
					defaultValue={initialValues.interval}
					min={1}
					max={1440}
					className="w-full"
				/>
			</div>
			<div className="w-[calc(50%-0.5rem)] sm:w-[100px]">
				<Label htmlFor="timeframe">Timeframe</Label>
				<Input
					name="timeframe"
					type="number"
					defaultValue={initialValues.timeframe}
					min={1}
					max={168}
					className="w-full"
				/>
			</div>
			<Button
				type="submit"
				size="sm"
				className="w-[calc(50%-0.5rem)] sm:w-auto"
			>
				Update
			</Button>
		</form>
	);
}
