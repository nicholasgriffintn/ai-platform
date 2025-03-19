import { Github, Loader2 } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Button } from "~/components/ui";
import { APP_NAME } from "~/constants";
import { useAuthStatus } from "~/hooks/useAuth";
import { apiKeyService } from "~/lib/api-key";
import { useChatStore } from "~/state/stores/chatStore";

interface LoginModalProps {
	onKeySubmit: () => void;
}

export const LoginModal = ({ onKeySubmit }: LoginModalProps) => {
	const [apiKey, setApiKey] = useState("");
	const [error, setError] = useState("");
	const [awaitingGithubLogin, setAwaitingGithubLogin] = useState(false);
	const { setHasApiKey } = useChatStore();
	const { isAuthenticated, isLoading, loginWithGithub } = useAuthStatus();

	if (isLoading) {
		return (
			<div className="p-6 flex flex-col items-center justify-center gap-4">
				<Loader2 size={32} className="animate-spin text-blue-600" />
				<p className="text-sm text-zinc-600 dark:text-zinc-400">
					Checking authentication status...
				</p>
			</div>
		);
	}

	if (isAuthenticated) {
		onKeySubmit();
		return (
			<div className="p-6">
				<h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
					You are already signed in.
				</h2>
			</div>
		);
	}

	const handleGithubLogin = async () => {
		setAwaitingGithubLogin(true);
		await loginWithGithub();
		setAwaitingGithubLogin(false);
	};

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		if (!apiKey.trim()) {
			setError("API key is required");
			return;
		}

		if (!apiKeyService.validateApiKey(apiKey)) {
			setError("Invalid API key format");
			return;
		}

		try {
			await apiKeyService.setApiKey(apiKey);
			setHasApiKey(true);
			onKeySubmit();
		} catch (error) {
			setError("Failed to save API key securely");
		}
	};

	return (
		<div className="p-6">
			<div className="space-y-6">
				<div>
					<h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
						Sign in to {APP_NAME}
					</h2>
					<p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
						Sign in with GitHub or enter your API key to continue.
					</p>
				</div>

				<Button
					type="button"
					variant="primary"
					onClick={handleGithubLogin}
					className="w-full bg-zinc-800 text-white hover:bg-zinc-700"
					disabled={awaitingGithubLogin}
					icon={<Github size={18} />}
					isLoading={awaitingGithubLogin}
				>
					Sign in with GitHub
				</Button>

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

				<form className="space-y-4" onSubmit={handleSubmit}>
					<div>
						<label
							htmlFor="apiKey"
							className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
						>
							API Key
						</label>
						<input
							id="apiKey"
							type="password"
							value={apiKey}
							onChange={(e) => {
								setApiKey(e.target.value);
								setError("");
							}}
							className="mt-1 block w-full rounded-md border border-zinc-300 dark:border-zinc-600 
								bg-off-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-white 
								placeholder-zinc-400 shadow-sm focus:border-blue-500 
								focus:outline-none focus:ring-1 focus:ring-blue-500"
							placeholder="Enter your API key"
						/>
						{error && (
							<p className="mt-2 text-sm text-red-600 dark:text-red-400">
								{error}
							</p>
						)}
					</div>
					<Button
						type="submit"
						variant="primary"
						className="w-full"
						isLoading={isLoading}
					>
						Submit
					</Button>
				</form>

				<div className="mt-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
					By continuing, you agree to our{" "}
					<a href="/terms" className="text-blue-600 hover:underline">
						Terms of Service
					</a>{" "}
					and{" "}
					<a href="/privacy" className="text-blue-600 hover:underline">
						Privacy Policy
					</a>
				</div>
			</div>
		</div>
	);
};
