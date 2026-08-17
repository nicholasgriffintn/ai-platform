import { SignInEmptyState as ControlledSignInEmptyState } from "@ngriffin_uk/polychat-component-ui";
import type { ReactNode } from "react";

import { useUIStore } from "~/state/stores/uiStore";

interface SignInEmptyStateProps {
	title?: ReactNode;
	message?: string;
	className?: string;
}

export function SignInEmptyState(props: SignInEmptyStateProps) {
	const setShowLoginModal = useUIStore((state) => state.setShowLoginModal);

	return <ControlledSignInEmptyState {...props} onSignIn={() => setShowLoginModal(true)} />;
}
