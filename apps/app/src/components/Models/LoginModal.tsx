import {
  AuthFlow,
  AuthProvider,
  type AuthProviderConfig,
  isWebAuthnSupported,
} from "@ngriffin_uk/auth-react";
import { AuthenticationStatusDialog, SignInDialog } from "@ngriffin_uk/polychat-component-account";
import { useEffect, useMemo } from "react";

import { API_BASE_URL, APPLE_SIGN_IN_CLIENT_ID, APP_NAME } from "~/constants";
import { useTrackEvent } from "~/hooks/use-track-event";
import { useAuthStatus } from "~/hooks/useAuth";
import { getLoginErrorMessage } from "~/lib/auth/login-error";

interface LoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onKeySubmit: () => void;
}

const DISPLAY_SIGN_IN_WITH_APPLE_BUTTON =
  import.meta.env.VITE_DISPLAY_SIGN_IN_WITH_APPLE_BUTTON === "true";
const AUTH_BUTTON_CLASS_NAME =
  "flex h-11 w-full items-center justify-center gap-2.5 rounded-lg px-4 text-sm font-semibold leading-none shadow-sm disabled:opacity-60";
const GITHUB_BUTTON_CLASS_NAME = `${AUTH_BUTTON_CLASS_NAME} border border-transparent bg-foreground text-background hover:bg-foreground/88`;
const PASSKEY_BUTTON_CLASS_NAME = `${AUTH_BUTTON_CLASS_NAME} border border-accent-teal/35 bg-accent-teal/12 text-accent-teal hover:bg-accent-teal/20`;
const EMAIL_BUTTON_CLASS_NAME = `${AUTH_BUTTON_CLASS_NAME} bg-human-action text-human-action-foreground hover:bg-human-action/88`;

export function LoginModal({ open, onOpenChange, onKeySubmit }: LoginModalProps) {
  const { isAuthenticated, isLoading, refreshAuthStatus } = useAuthStatus();
  const { trackAuth, trackError } = useTrackEvent();

  useEffect(() => {
    if (open && isAuthenticated) {
      onOpenChange(false);
    }
  }, [isAuthenticated, onOpenChange, open]);

  const config = useMemo<AuthProviderConfig>(
    () => ({
      endpoint: `${API_BASE_URL}/auth`,
      capabilities: {
        magicLink: true,
        password: false,
        passkeys: isWebAuthnSupported(),
        recovery: false,
        signUp: false,
      },
      providers: [
        {
          id: "github",
          label: "Sign in with GitHub",
        },
        ...(DISPLAY_SIGN_IN_WITH_APPLE_BUTTON
          ? [
              {
                id: "apple",
                label: "Sign in with Apple",
                clientId: APPLE_SIGN_IN_CLIENT_ID,
                className: "!border-transparent !bg-surface !p-0 overflow-hidden [&>div]:w-full",
              },
            ]
          : []),
      ],
      signInFields: [
        {
          name: "email",
          label: "Email Address",
          type: "email",
          autoComplete: "email",
          inputMode: "email",
          placeholder: "Enter your email address",
          required: true,
        },
      ],
      copy: {
        signInTitle: `Sign in to ${APP_NAME}`,
        signInDescription: "Sign in with GitHub, Passkey, Apple, or use a Magic Link to continue.",
        signInSeparator: "Or continue with",
        magicLinkSubmit: "Sign in with Email",
        passkeyLabel: "Sign in with Passkey",
      },
      classNames: {
        panel: "mx-auto w-full max-w-[375px] space-y-3",
        signIn: "space-y-3",
        header: "mb-3 space-y-1",
        title: "text-xl font-semibold text-foreground",
        providerList: "space-y-3",
        providerButton: GITHUB_BUTTON_CLASS_NAME,
        button: EMAIL_BUTTON_CLASS_NAME,
        passkeyButton: PASSKEY_BUTTON_CLASS_NAME,
        magicLinkButton: EMAIL_BUTTON_CLASS_NAME,
        form: "flex flex-col gap-2",
        field: "flex flex-col gap-2",
        label: "text-sm font-medium text-foreground",
        input:
          "border-border bg-surface text-foreground focus:border-active-work h-11 w-full rounded-lg border pr-3 pl-10 outline-none",
        inputContainer: "relative w-full",
        inputIcon:
          "pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground",
        error: "rounded-md border border-failure/40 bg-failure/10 px-3 py-2 text-sm text-failure",
        separator:
          "flex items-center gap-2 py-3 text-sm text-muted-foreground before:h-px before:flex-1 before:bg-selection after:h-px after:flex-1 after:bg-selection",
        status: "text-sm text-success",
      },
      mapError: (error) => {
        const message = error instanceof Error ? error.message : "Sign-in failed.";

        trackError("auth_error", message, { method: "shared_auth_flow" });

        return getLoginErrorMessage(message, "email");
      },
      onAnalytics: (event) => {
        if (event.name === "request" && !event.status) {
          trackAuth("auth_attempt", {
            method: event.provider ?? event.action ?? "shared_auth_flow",
          });
        }
      },
      onAuthenticated: () => {
        trackAuth("auth_success", { method: "shared_auth_flow" });
        void refreshAuthStatus().then(() => onKeySubmit());
      },
    }),
    [onKeySubmit, refreshAuthStatus, trackAuth, trackError],
  );

  if (isLoading) {
    return <AuthenticationStatusDialog open={open} onOpenChange={onOpenChange} />;
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <SignInDialog open={open} onOpenChange={onOpenChange} appName={APP_NAME}>
      <AuthProvider config={config}>
        <AuthFlow />
      </AuthProvider>
    </SignInDialog>
  );
}
