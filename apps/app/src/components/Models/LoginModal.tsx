import { AlertCircle, KeySquare, Loader2, Mail } from "lucide-react";
import { useEffect, useState } from "react";

import { SignInWithAppleWebButton } from "~/components/Auth/SignInWithAppleWebButton";
import GithubIcon from "~/components/ModelIcon/Icons/github";
import { Button, FormInput } from "~/components/ui";
import { Dialog, DialogContent } from "~/components/ui/Dialog";
import { APP_NAME } from "~/constants";
import { useTrackEvent } from "~/hooks/use-track-event";
import { useAuthStatus } from "~/hooks/useAuth";
import { usePasskeys } from "~/hooks/usePasskeys";
import { authService } from "~/lib/api/auth-service";
import { getLoginErrorMessage } from "~/lib/auth/login-error";

interface LoginModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onKeySubmit: () => void;
}

const AUTH_CONTROL_CLASS_NAME = "mx-auto w-full max-w-[375px]";
const MATCHED_PROVIDER_BUTTON_CLASS_NAME =
	"h-11 w-full border border-zinc-300 bg-white text-lg font-medium leading-none text-zinc-900 shadow-none hover:bg-zinc-50 dark:border-zinc-600 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100";
const MATCHED_PROVIDER_ICON_SIZE = 22;

export const LoginModal = ({ open, onOpenChange, onKeySubmit }: LoginModalProps) => {
	const [email, setEmail] = useState("");
	const [emailSubmitted, setEmailSubmitted] = useState(false);
	const [isRequestingLink, setIsRequestingLink] = useState(false);
	const [authError, setAuthError] = useState("");
	const [emailError, setEmailError] = useState("");
	const [awaitingGithubLogin, setAwaitingGithubLogin] = useState(false);
	const { isAuthenticated, isLoading, loginWithGithub } = useAuthStatus();
	const { authenticateWithPasskey, isAuthenticatingWithPasskey } = usePasskeys();
	const { trackAuth, trackError } = useTrackEvent();
	const [passkeysSupported, setPasskeysSupported] = useState(false);

	useEffect(() => {
		const checkPasskeySupport = async () => {
			setPasskeysSupported(authService.isPasskeySupported());
		};
		checkPasskeySupport();
	}, []);

	useEffect(() => {
		if (isAuthenticated && open) {
			trackAuth("auth_success", { method: "auto" });
			onKeySubmit();
		}
	}, [isAuthenticated, open, onKeySubmit, trackAuth]);

	const handleMagicLinkRequest = async () => {
		setAuthError("");
		setEmailError("");
		setEmailSubmitted(false);

		if (!email || !email.includes("@")) {
			setEmailError("Please enter a valid email address");
			trackAuth("auth_validation_error", {
				method: "email",
				reason: "invalid_email",
			});
			return;
		}

		setIsRequestingLink(true);
		trackAuth("auth_attempt", { method: "email" });

		try {
			const result = await authService.requestMagicLink(email);
			if (result.success) {
				setEmailSubmitted(true);
				trackAuth("magic_link_sent", { email_domain: email.split("@")[1] });
			} else {
				setAuthError(
					getLoginErrorMessage(
						result.error || "Failed to send magic link. Please try again.",
						"email",
					),
				);
				trackError("magic_link_error", result.error || "Unknown error", {
					method: "email",
				});
			}
		} catch (err: any) {
			setAuthError(
				getLoginErrorMessage("An unexpected error occurred. Please try again.", "email"),
			);
			trackError("magic_link_error", err, { method: "email" });
			console.error("Magic link request error:", err);
		} finally {
			setIsRequestingLink(false);
		}
	};

	const handleGithubLogin = async () => {
		setAuthError("");
		setEmailError("");
		setAwaitingGithubLogin(true);
		trackAuth("auth_attempt", { method: "github" });
		try {
			await loginWithGithub();
		} catch (err) {
			setAuthError(
				getLoginErrorMessage("GitHub sign-in failed. Please try another method.", "github"),
			);
			trackError("auth_error", err, { method: "github" });
		} finally {
			setAwaitingGithubLogin(false);
		}
	};

	const handlePasskeyLogin = async () => {
		setAuthError("");
		setEmailError("");
		trackAuth("auth_attempt", { method: "passkey" });
		try {
			const result = await authenticateWithPasskey();
			if (result?.verified) {
				trackAuth("auth_success", { method: "passkey" });
				onKeySubmit();
			} else {
				setAuthError(getLoginErrorMessage("Passkey authentication failed", "passkey"));
				trackAuth("auth_failure", {
					method: "passkey",
					reason: "verification_failed",
				});
			}
		} catch (error) {
			setAuthError(
				getLoginErrorMessage(
					"Passkey authentication failed. Please try another method.",
					"passkey",
				),
			);
			trackError("auth_error", error, { method: "passkey" });
			console.error("Passkey authentication error:", error);
		}
	};

	if (isLoading) {
		return (
			<Dialog open={open} onOpenChange={onOpenChange} width="480px">
				<DialogContent>
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

	if (isAuthenticated) {
		return (
			<Dialog open={open} onOpenChange={onOpenChange} width="480px">
				<DialogContent>
					<div className="p-6">
						<h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
							You are already signed in.
						</h2>
					</div>
				</DialogContent>
			</Dialog>
		);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange} width="480px">
			<DialogContent>
				<div className="p-6">
					<div className="space-y-6">
						<div>
							<h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
								Sign in to {APP_NAME}
							</h2>
							<p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
								Sign in with GitHub, Passkey, Apple, or use a Magic Link to continue.
							</p>
						</div>

						<div className={`${AUTH_CONTROL_CLASS_NAME} space-y-6`}>
							{authError && (
								<div
									role="alert"
									className="flex gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300"
								>
									<AlertCircle size={16} className="mt-0.5 shrink-0" />
									<p>{authError}</p>
								</div>
							)}

							<div className="space-y-3">
								<Button
									type="button"
									variant="primary"
									onClick={handleGithubLogin}
									className={MATCHED_PROVIDER_BUTTON_CLASS_NAME}
									disabled={isAuthenticatingWithPasskey || isRequestingLink}
									icon={<GithubIcon size={MATCHED_PROVIDER_ICON_SIZE} />}
									isLoading={awaitingGithubLogin}
								>
									Sign in with GitHub
								</Button>

								{passkeysSupported && (
									<Button
										type="button"
										variant="primary"
										onClick={handlePasskeyLogin}
										className={MATCHED_PROVIDER_BUTTON_CLASS_NAME}
										disabled={awaitingGithubLogin || isRequestingLink}
										icon={<KeySquare size={MATCHED_PROVIDER_ICON_SIZE} />}
										isLoading={isAuthenticatingWithPasskey}
									>
										Sign in with Passkey
									</Button>
								)}

								<SignInWithAppleWebButton
									disabled={awaitingGithubLogin || isAuthenticatingWithPasskey || isRequestingLink}
									onAttempt={() => {
										setAuthError("");
										setEmailError("");
										trackAuth("auth_attempt", { method: "apple" });
									}}
									onSuccess={() => {
										trackAuth("auth_success", { method: "apple" });
										onKeySubmit();
									}}
									onError={(message) => {
										setAuthError(getLoginErrorMessage(message, "apple"));
										trackAuth("auth_failure", { method: "apple", reason: message });
									}}
								/>
							</div>

							<div className="relative">
								<div className="absolute inset-0 flex items-center">
									<div className="w-full border-t border-zinc-300 dark:border-zinc-700" />
								</div>
								<div className="relative flex justify-center text-sm">
									<span className="bg-off-white dark:bg-zinc-900 px-2 text-zinc-500">
										Or continue with
									</span>
								</div>
							</div>

							<div className="space-y-2">
								<FormInput
									id="email"
									label="Email Address"
									type="email"
									value={email}
									onChange={(e) => {
										setEmail(e.target.value);
										setAuthError("");
										setEmailError("");
										setEmailSubmitted(false);
									}}
									placeholder="Enter your email address"
									className={emailError ? "border-red-500" : ""}
									description={emailError || undefined}
									disabled={isRequestingLink}
								/>
								{emailSubmitted ? (
									<p className="text-sm text-green-600 dark:text-green-400">
										Check your email for a magic link to sign in!
									</p>
								) : (
									<Button
										type="button"
										variant="primary"
										onClick={handleMagicLinkRequest}
										className="h-11 w-full"
										isLoading={isRequestingLink}
										icon={<Mail size={18} />}
										disabled={!email}
									>
										Sign in with Email
									</Button>
								)}
							</div>

							<div className="mt-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
								By continuing, you agree to our{" "}
								<a href="/terms" className="text-blue-600">
									Terms of Service
								</a>{" "}
								and{" "}
								<a href="/privacy" className="text-blue-600">
									Privacy Policy
								</a>
							</div>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
};
