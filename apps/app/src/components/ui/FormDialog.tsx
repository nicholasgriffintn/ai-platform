import { Loader2 } from "lucide-react";
import type { FormEvent, ReactNode } from "react";

import { Button } from "./Button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./Dialog";

interface FormDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Dialog title */
  title: string;
  /** Optional dialog description */
  description?: string;
  /** Form content */
  children: ReactNode;
  /** Callback when form is submitted */
  onSubmit: () => void | Promise<void>;
  /** Text for submit button */
  submitText?: string;
  /** Text for cancel button */
  cancelText?: string;
  /** Whether the form is currently submitting */
  isLoading?: boolean;
  /** Whether submit button should be disabled */
  submitDisabled?: boolean;
  /** Variant for submit button */
  submitVariant?: "default" | "primary" | "secondary";
}

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  submitText = "Submit",
  cancelText = "Cancel",
  isLoading = false,
  submitDisabled = false,
  submitVariant = "primary",
}: FormDialogProps) {
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await onSubmit();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogClose onClick={() => onOpenChange(false)} />

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {children}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              {cancelText}
            </Button>
            <Button
              type="submit"
              variant={submitVariant}
              disabled={submitDisabled || isLoading}
              isLoading={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                submitText
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
