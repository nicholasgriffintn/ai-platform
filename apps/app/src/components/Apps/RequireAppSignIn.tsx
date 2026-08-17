import { PageStatus } from "@ngriffin_uk/polychat-component-ui";
import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { SignInEmptyState } from "~/components/Core/SignInEmptyState";
import { useAuthStatus } from "~/hooks/useAuth";

interface RequireAppSignInProps {
	children: ReactNode;
}

export function RequireAppSignIn({ children }: RequireAppSignInProps) {
	const { isAuthenticated, isLoading } = useAuthStatus();

	if (isLoading) {
		return (
			<PageStatus
				icon={<Loader2 size={32} className="animate-spin text-blue-600" />}
				message="Loading..."
				className="h-auto min-h-[200px]"
			/>
		);
	}

	if (!isAuthenticated) {
		return (
			<SignInEmptyState
				title="Sign in to use this app"
				message="Sign in to continue using this app."
				className="h-auto min-h-[200px]"
			/>
		);
	}

	return <>{children}</>;
}
