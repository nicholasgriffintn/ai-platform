import {
	AuthFlow,
	AuthProvider,
	type AuthProviderConfig,
	isWebAuthnSupported,
} from "@ngriffin_uk/auth-react";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo } from "react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "~/components/ui/Dialog";
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
	import.meta.env.NEXT_PUBLIC_DISPLAY_SIGN_IN_WITH_APPLE_BUTTON === "true";
const AUTH_BUTTON_CLASS_NAME =
	"flex h-11 w-full items-center justify-center gap-2.5 rounded-lg px-4 text-sm font-semibold leading-none shadow-sm disabled:opacity-60";
const GITHUB_BUTTON_CLASS_NAME = `${AUTH_BUTTON_CLASS_NAME} border border-zinc-950 bg-zinc-950 text-white hover:bg-zinc-800 dark:border-zinc-700`;
const PASSKEY_BUTTON_CLASS_NAME = `${AUTH_BUTTON_CLASS_NAME} border border-teal-600/30 bg-teal-50 text-teal-950 hover:bg-teal-100 dark:border-teal-400/35 dark:bg-teal-400/10 dark:text-teal-50 dark:hover:bg-teal-400/15`;
const EMAIL_BUTTON_CLASS_NAME = `${AUTH_BUTTON_CLASS_NAME} bg-blue-600 text-white hover:bg-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400`;

export function LoginModal({ open, onOpenChange, onKeySubmit }: LoginModalProps) {
	const { isAuthenticated, isLoading } = useAuthStatus();
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
								className: "!border-zinc-300 !bg-white !p-0 dark:!border-zinc-600 dark:!bg-white",
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
				title: "text-xl font-semibold text-zinc-900 dark:text-white",
				providerList: "space-y-3",
				providerButton: GITHUB_BUTTON_CLASS_NAME,
				button: EMAIL_BUTTON_CLASS_NAME,
				passkeyButton: PASSKEY_BUTTON_CLASS_NAME,
				magicLinkButton: EMAIL_BUTTON_CLASS_NAME,
				form: "flex flex-col gap-2",
				field: "flex flex-col gap-2",
				label: "text-sm font-medium text-zinc-800 dark:text-zinc-200",
				input:
					"h-11 rounded-lg border border-zinc-300 bg-white px-3 text-zinc-950 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white",
				error:
					"rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300",
				separator:
					"flex items-center gap-2 py-3 text-sm text-zinc-500 before:h-px before:flex-1 before:bg-zinc-300 after:h-px after:flex-1 after:bg-zinc-300 dark:before:bg-zinc-700 dark:after:bg-zinc-700",
				status: "text-sm text-green-600 dark:text-green-400",
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
				onKeySubmit();
			},
		}),
		[onKeySubmit, trackAuth, trackError],
	);

	if (isLoading) {
		return <AuthenticationStatusDialog open={open} onOpenChange={onOpenChange} />;
	}

	if (isAuthenticated) {
		return null;
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange} width="480px">
			<DialogContent>
				<DialogTitle className="sr-only">Sign in to {APP_NAME}</DialogTitle>
				<DialogDescription className="sr-only">
					Sign in with GitHub, Passkey, Apple, or use a Magic Link to continue.
				</DialogDescription>
				<div className="space-y-6 p-6">
					<AuthProvider config={config}>
						<AuthFlow />
					</AuthProvider>
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

function AuthenticationStatusDialog({
	open,
	onOpenChange,
}: Pick<LoginModalProps, "open" | "onOpenChange">) {
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
