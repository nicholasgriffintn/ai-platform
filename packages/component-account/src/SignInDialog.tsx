import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@ngriffin_uk/polychat-component-ui";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export interface SignInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appName: string;
  children: ReactNode;
}

export function SignInDialog({ open, onOpenChange, appName, children }: SignInDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} width="480px">
      <DialogContent>
        <DialogTitle className="sr-only">Sign in to {appName}</DialogTitle>
        <DialogDescription className="sr-only">
          Sign in with GitHub, Passkey, Apple, or use a Magic Link to continue.
        </DialogDescription>
        <div className="space-y-6 p-6">
          {children}
          <p className="mx-auto max-w-[375px] text-center text-sm text-zinc-500 dark:text-zinc-400">
            By continuing, you agree to our{" "}
            <a href="/terms" className="text-blue-600">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="/privacy" className="text-blue-600">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export interface AuthenticationStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthenticationStatusDialog({
  open,
  onOpenChange,
}: AuthenticationStatusDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} width="480px">
      <DialogContent>
        <DialogTitle className="sr-only">Checking authentication status</DialogTitle>
        <DialogDescription className="sr-only">
          Wait while your authentication status is checked.
        </DialogDescription>
        <div className="flex flex-col items-center justify-center gap-4 py-8">
          <Loader2 size={32} className="animate-spin text-blue-600" />
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Checking authentication status...
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
