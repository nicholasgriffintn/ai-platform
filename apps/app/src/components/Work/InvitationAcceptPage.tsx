import { CheckCircle2, Link2, LogIn } from "lucide-react";
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { Button, Card } from "~/components/ui";
import { useAcceptWorkspaceInvitation } from "~/hooks/useWorkspaces";
import { useChatStore } from "~/state/stores/chatStore";
import { useUIStore } from "~/state/stores/uiStore";

export function InvitationAcceptPage() {
	const [searchParams] = useSearchParams();
	const token = searchParams.get("token");
	const isAuthenticated = useChatStore((state) => state.isAuthenticated);
	const setShowLoginModal = useUIStore((state) => state.setShowLoginModal);
	const acceptInvitation = useAcceptWorkspaceInvitation();
	const navigate = useNavigate();

	useEffect(() => {
		if (
			isAuthenticated &&
			token &&
			!acceptInvitation.data &&
			!acceptInvitation.isPending &&
			!acceptInvitation.error
		) {
			acceptInvitation.mutate(token);
		}
	}, [acceptInvitation, isAuthenticated, token]);

	return (
		<main className="mx-auto flex min-h-full max-w-xl items-center px-6 py-16">
			<Card className="w-full p-8 text-center">
				{acceptInvitation.data ? (
					<CheckCircle2 size={36} className="mx-auto text-emerald-600" />
				) : (
					<Link2 size={34} className="mx-auto text-zinc-500" />
				)}
				<h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
					{acceptInvitation.data
						? `Welcome to ${acceptInvitation.data.name}`
						: "Workspace invitation"}
				</h1>
				{!token && <p className="text-sm text-red-700">This invitation link is incomplete.</p>}
				{token && !isAuthenticated && (
					<>
						<p className="text-sm leading-6 text-zinc-500">
							Sign in with the email address that received this secure invitation.
						</p>
						<Button
							variant="primary"
							size="lg"
							fullWidth
							icon={<LogIn size={18} />}
							onClick={() => setShowLoginModal(true)}
						>
							Sign in to accept
						</Button>
					</>
				)}
				{acceptInvitation.isPending && (
					<p className="text-sm text-zinc-500">Checking your invitation…</p>
				)}
				{acceptInvitation.error && (
					<p className="text-sm text-red-700">{acceptInvitation.error.message}</p>
				)}
				{acceptInvitation.data && (
					<Button onClick={() => navigate(`/work/${acceptInvitation.data.id}`)}>
						Open workspace
					</Button>
				)}
			</Card>
		</main>
	);
}
