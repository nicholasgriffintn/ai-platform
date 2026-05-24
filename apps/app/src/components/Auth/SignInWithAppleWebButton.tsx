import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
	configureAppleSignIn,
	getAppleFullName,
	getAppleIdentityToken,
	getAppleSignInFailureDetail,
	getAppleSignInSuccessDetail,
	getAppleState,
	isAppleSignInConfigured,
} from "~/lib/auth/apple-sign-in";
import { authService } from "~/lib/api/auth-service";

interface SignInWithAppleWebButtonProps {
	disabled?: boolean;
	onAttempt: () => void;
	onSuccess: () => void;
	onError: (error: string) => void;
}

export function SignInWithAppleWebButton({
	disabled = false,
	onAttempt,
	onSuccess,
	onError,
}: SignInWithAppleWebButtonProps) {
	const [isReady, setIsReady] = useState(false);
	const [isSigningIn, setIsSigningIn] = useState(false);
	const nonceRef = useRef<string | null>(null);
	const stateRef = useRef<string | null>(null);

	const initialise = useCallback(async () => {
		if (!isAppleSignInConfigured()) {
			return;
		}

		try {
			const { nonce, state } = await configureAppleSignIn();
			nonceRef.current = nonce;
			stateRef.current = state;
			setIsReady(true);
		} catch (error) {
			onError(error instanceof Error ? error.message : "Apple Sign in failed to initialise.");
		}
	}, [onError]);

	useEffect(() => {
		void initialise();
	}, [initialise]);

	useEffect(() => {
		const handleSuccess = async (event: Event) => {
			const detail = getAppleSignInSuccessDetail(event);
			const identityToken = detail ? getAppleIdentityToken(detail) : null;
			const state = detail ? getAppleState(detail) : null;
			const nonce = nonceRef.current;

			if (!detail || !identityToken || !nonce) {
				onError("Apple Sign in did not return valid credentials.");
				void initialise();
				return;
			}

			if (!state || state !== stateRef.current) {
				onError("Apple Sign in state did not match.");
				void initialise();
				return;
			}

			setIsSigningIn(true);
			onAttempt();

			try {
				const result = await authService.signInWithApple({
					identityToken,
					nonce,
					fullName: getAppleFullName(detail),
				});

				if (result.success) {
					onSuccess();
				} else {
					onError(result.error || "Apple Sign in failed.");
				}
			} finally {
				setIsSigningIn(false);
				setIsReady(false);
				void initialise();
			}
		};

		const handleFailure = (event: Event) => {
			const detail = getAppleSignInFailureDetail(event);
			onError(detail?.error || "Apple Sign in was cancelled.");
			void initialise();
		};

		document.addEventListener("AppleIDSignInOnSuccess", handleSuccess);
		document.addEventListener("AppleIDSignInOnFailure", handleFailure);

		return () => {
			document.removeEventListener("AppleIDSignInOnSuccess", handleSuccess);
			document.removeEventListener("AppleIDSignInOnFailure", handleFailure);
		};
	}, [initialise, onAttempt, onError, onSuccess]);

	if (!isAppleSignInConfigured()) {
		return null;
	}

	return (
		<div
			className={[
				"relative h-11 w-full overflow-hidden rounded-md",
				disabled || !isReady || isSigningIn ? "pointer-events-none opacity-60" : "",
			].join(" ")}
		>
			{(!isReady || isSigningIn) && (
				<div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-zinc-900">
					<Loader2 size={18} className="animate-spin text-white" />
				</div>
			)}
			<div
				id="appleid-signin"
				data-color="black"
				data-border="false"
				data-border-radius="8"
				data-type="sign-in"
				data-width="100%"
				data-height="44"
			/>
		</div>
	);
}
