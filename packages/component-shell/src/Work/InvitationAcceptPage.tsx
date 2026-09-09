import { InvitationAcceptView } from "@ngriffin_uk/polychat-component-workspaces";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  useAcceptWorkspaceInvitation,
  isAuthenticationError,
  clearWorkspaceInvitationToken,
  consumeWorkspaceInvitationToken,
  useUIStore,
} from "@ngriffin_uk/polychat-library-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

export function InvitationAcceptPage() {
  const [searchParams] = useSearchParams();
  const [token] = useState(() => consumeWorkspaceInvitationToken(searchParams.get("token")));
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

  useEffect(() => {
    if (acceptInvitation.data) {
      clearWorkspaceInvitationToken();
    }
  }, [acceptInvitation.data]);

  const sessionExpired = isAuthenticationError(acceptInvitation.error);

  return (
    <InvitationAcceptView
      hasToken={!!token}
      requiresSignIn={(!!token && !isAuthenticated) || sessionExpired}
      sessionExpired={sessionExpired}
      onSignIn={() => setShowLoginModal(true)}
      isAccepting={acceptInvitation.isPending}
      errorMessage={acceptInvitation.error?.message}
      acceptedWorkspace={acceptInvitation.data ?? null}
      onOpenWorkspace={(workspaceId) => void navigate(`/work/${workspaceId}`)}
    />
  );
}
