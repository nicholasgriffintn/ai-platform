import { Loader2 } from "lucide-react";
import { Link } from "react-router";

import { useAuthStatus } from "~/hooks/useAuth";
import { useChatStore } from "~/state/stores/chatStore";
import { useUIStore } from "~/state/stores/uiStore";

interface FooterInfoProps {
	isPanelVisible: boolean;
}

export const FooterInfo = ({ isPanelVisible }: FooterInfoProps) => {
	const { currentConversationId } = useChatStore();
	const { isAuthenticated, isLoading: isAuthLoading } = useAuthStatus();
	const { isMobile } = useUIStore();

	return (
		<div
			className={`absolute bottom-4 left-0 right-0 text-center text-sm text-zinc-600 dark:text-zinc-400 ${
				isPanelVisible
					? "pr-[90%] sm:pr-[350px] md:pr-[400px] lg:pr-[650px]"
					: ""
			}`}
		>
			{isAuthLoading ? (
				<p className="mb-1 flex items-center justify-center gap-2">
					<Loader2 size={12} className="animate-spin" />
					<span>Loading...</span>
				</p>
			) : (
				<p className="mb-1">
					{isAuthenticated || currentConversationId ? (
						<>
							AI can make mistakes.
							{!isMobile &&
								!isPanelVisible &&
								" Check relevant sources before making important decisions."}
						</>
					) : (
						<>
							By using Polychat, you agree to our{" "}
							<Link
								to="/terms"
								className="hover:text-zinc-800 dark:hover:text-zinc-200 underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-sm"
							>
								Terms
							</Link>{" "}
							&{" "}
							<Link
								to="/privacy"
								className="hover:text-zinc-800 dark:hover:text-zinc-200 underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-sm"
							>
								Privacy
							</Link>
							.
						</>
					)}
				</p>
			)}
		</div>
	);
};
