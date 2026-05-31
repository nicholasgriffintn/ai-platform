import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { PageStatus } from "~/components/Core/PageStatus";
import { Button } from "~/components/ui/Button";
import { useAuthStatus } from "~/hooks/useAuth";
import { useUIStore } from "~/state/stores/uiStore";

interface RequireAppSignInProps {
	children: ReactNode;
}

export function RequireAppSignIn({ children }: RequireAppSignInProps) {
	const { isAuthenticated, isLoading } = useAuthStatus();
	const { setShowLoginModal } = useUIStore();

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
			<PageStatus message="Sign in to use this app." className="h-auto min-h-[200px]">
				<Button type="button" variant="primary" onClick={() => setShowLoginModal(true)}>
					Login
				</Button>
			</PageStatus>
		);
	}

	return <>{children}</>;
}
