import { LogIn } from "lucide-react";
import type { ReactNode } from "react";

import { EmptyState } from "~/components/Core/EmptyState";
import { Button } from "~/components/ui/Button";
import { useUIStore } from "~/state/stores/uiStore";

interface SignInEmptyStateProps {
	title?: ReactNode;
	message?: string;
	className?: string;
}

export function SignInEmptyState({
	title = "Sign in to continue",
	message = "Sign in to access this area of Polychat.",
	className,
}: SignInEmptyStateProps) {
	const setShowLoginModal = useUIStore((state) => state.setShowLoginModal);

	return (
		<EmptyState
			icon={<LogIn className="text-blue-600 dark:text-blue-400" size={24} aria-hidden="true" />}
			title={title}
			message={message}
			action={
				<Button type="button" variant="primary" onClick={() => setShowLoginModal(true)}>
					Sign in
				</Button>
			}
			className={className}
		/>
	);
}
