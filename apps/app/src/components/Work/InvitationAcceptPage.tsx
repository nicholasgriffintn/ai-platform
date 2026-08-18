import { InvitationAcceptView } from "@ngriffin_uk/polychat-component-workspaces";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { useAcceptWorkspaceInvitation } from "~/hooks/useWorkspaces";
import { isAuthenticationError } from "~/lib/errors";
import {
  clearWorkspaceInvitationToken,
  consumeWorkspaceInvitationToken,
} from "~/lib/work/invitation-token";
import { useChatStore } from "~/state/stores/chatStore";
import { useUIStore } from "~/state/stores/uiStore";

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
    if (acceptInvitation.data) clearWorkspaceInvitationToken();
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
      onOpenWorkspace={(workspaceId) => navigate(`/work/${workspaceId}`)}
    />
  );
}
