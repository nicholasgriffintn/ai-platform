import type { AssistantRecipe } from "@assistant/schemas";

import { Checkbox, FormDialog, Input, Label, Textarea } from "~/components/ui";
import { isRecipeScheduleCronSupported } from "~/lib/recipes";

interface RecipeScheduleDialogProps {
	recipe: AssistantRecipe | null;
	hasExistingSchedule: boolean;
	cronExpression: string;
	prompt: string;
	notifySms: boolean;
	smsTarget: string;
	onCronExpressionChange: (cronExpression: string) => void;
	onPromptChange: (prompt: string) => void;
	onNotifySmsChange: (notifySms: boolean) => void;
	onSmsTargetChange: (smsTarget: string) => void;
	onClose: () => void;
	onSubmit: () => void | Promise<void>;
	isLoading: boolean;
}

export function RecipeScheduleDialog({
	recipe,
	hasExistingSchedule,
	cronExpression,
	prompt,
	notifySms,
	smsTarget,
	onCronExpressionChange,
	onPromptChange,
	onNotifySmsChange,
	onSmsTargetChange,
	onClose,
	onSubmit,
	isLoading,
}: RecipeScheduleDialogProps) {
	const cronIsSupported = isRecipeScheduleCronSupported(cronExpression);
	return (
		<FormDialog
			open={recipe !== null}
			onOpenChange={(open) => {
				if (!open) {
					onClose();
				}
			}}
			title={recipe ? `Schedule ${recipe.title}` : "Schedule recipe"}
			onSubmit={onSubmit}
			submitText={hasExistingSchedule ? "Save schedule" : "Schedule"}
			isLoading={isLoading}
			submitDisabled={!cronIsSupported || (notifySms && !smsTarget.trim())}
		>
			<div className="space-y-2">
				<Label htmlFor="recipe-cron-expression">Cron expression</Label>
				<Input
					id="recipe-cron-expression"
					value={cronExpression}
					onChange={(event) => onCronExpressionChange(event.target.value)}
					placeholder="0 9 * * *"
				/>
				{cronExpression.trim() && !cronIsSupported && (
					<p className="text-sm text-red-600 dark:text-red-400">
						Use five fields with numeric values, lists, ranges, steps, or `*`.
					</p>
				)}
			</div>
			<div className="space-y-2">
				<Label htmlFor="recipe-schedule-prompt">Prompt</Label>
				<Textarea
					id="recipe-schedule-prompt"
					value={prompt}
					onChange={(event) => onPromptChange(event.target.value)}
					rows={5}
				/>
			</div>
			<div className="space-y-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
				<label className="flex items-start gap-3">
					<Checkbox
						checked={notifySms}
						onCheckedChange={(checked) => onNotifySmsChange(checked === true)}
					/>
					<span>
						<span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
							Send result by SMS
						</span>
						<span className="block text-sm text-zinc-500 dark:text-zinc-400">
							Uses your configured Twilio or AWS SMS provider.
						</span>
					</span>
				</label>
				{notifySms && (
					<div className="space-y-2">
						<Label htmlFor="recipe-sms-target">SMS target</Label>
						<Input
							id="recipe-sms-target"
							value={smsTarget}
							onChange={(event) => onSmsTargetChange(event.target.value)}
							placeholder="+44......."
						/>
					</div>
				)}
			</div>
		</FormDialog>
	);
}
