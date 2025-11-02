import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "./Button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "./Dialog";

interface ConfirmationDialogProps {
	/** Whether the dialog is open */
	open: boolean;
	/** Callback when dialog open state changes */
	onOpenChange: (open: boolean) => void;
	/** Dialog title */
	title: string;
	/** Dialog description/message */
	description: string | ReactNode;
	/** Text for confirm button */
	confirmText?: string;
	/** Text for cancel button */
	cancelText?: string;
	/** Callback when confirmed */
	onConfirm: () => void | Promise<void>;
	/** Style variant of confirm button */
	variant?: "default" | "destructive" | "primary";
	/** Whether the action is currently loading */
	isLoading?: boolean;
	/** Additional content to show in the dialog */
	children?: ReactNode;
}

export function ConfirmationDialog({
	open,
	onOpenChange,
	title,
	description,
	confirmText = "Confirm",
	cancelText = "Cancel",
	onConfirm,
	variant = "default",
	isLoading = false,
	children,
}: ConfirmationDialogProps) {
	const handleConfirm = async () => {
		await onConfirm();
		if (!isLoading) {
			onOpenChange(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					{typeof description === "string" ? (
						<DialogDescription>{description}</DialogDescription>
					) : (
						<div className="text-sm text-muted-foreground">{description}</div>
					)}
				</DialogHeader>
				{children && <div className="py-4">{children}</div>}
				<div className="flex justify-end gap-3">
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isLoading}
					>
						{cancelText}
					</Button>
					<Button
						variant={variant}
						onClick={handleConfirm}
						disabled={isLoading}
					>
						{isLoading ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Loading...
							</>
						) : (
							confirmText
						)}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
