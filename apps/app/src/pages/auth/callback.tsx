import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router";

import { useAuthStatus } from "~/hooks/useAuth";

const AuthCallback = () => {
	const navigate = useNavigate();
	const { isLoading } = useAuthStatus();

	useEffect(() => {
		if (!isLoading) {
			navigate("/");
		}
	}, [isLoading, navigate]);

	return (
		<div className="flex flex-col items-center justify-center h-screen gap-4">
			<Loader2 size={32} className="animate-spin text-blue-600" />
			<p className="text-sm text-zinc-600 dark:text-zinc-400">
				Completing authentication...
			</p>
		</div>
	);
};

export default function AuthCallbackRoute() {
	return <AuthCallback />;
}
