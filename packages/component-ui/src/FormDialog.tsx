import type { FormEvent, ReactNode } from "react";

import { Button } from "./Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./Dialog";

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  onSubmit: () => void | Promise<void>;
  submitText?: string;
  cancelText?: string;
  isLoading?: boolean;
  submitDisabled?: boolean;
  submitVariant?: "default" | "primary" | "secondary";
  size?: FormDialogSize;
}

export type FormDialogSize = "md" | "lg";

const SIZE_CLASSES: Record<FormDialogSize, string> = {
  md: "sm:max-w-md",
  lg: "sm:max-w-2xl",
};

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
  size = "md",
}: FormDialogProps) {
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await onSubmit();
    } catch {
      return;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={SIZE_CLASSES[size]}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <form
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
          className="min-w-0 space-y-4 py-2"
        >
          {children}

          <DialogFooter className="pt-4">
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
              {isLoading ? "Submitting..." : submitText}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
