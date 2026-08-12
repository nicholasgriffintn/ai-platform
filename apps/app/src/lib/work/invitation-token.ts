const INVITATION_TOKEN_SESSION_KEY = "polychat.workspace-invitation-token";

export function consumeWorkspaceInvitationToken(queryToken: string | null): string | null {
	if (typeof window === "undefined") return queryToken;
	if (queryToken) {
		window.sessionStorage.setItem(INVITATION_TOKEN_SESSION_KEY, queryToken);
		const url = new URL(window.location.href);
		url.searchParams.delete("token");
		window.history.replaceState(
			window.history.state,
			"",
			`${url.pathname}${url.search}${url.hash}`,
		);
		return queryToken;
	}
	return window.sessionStorage.getItem(INVITATION_TOKEN_SESSION_KEY);
}

export function clearWorkspaceInvitationToken(): void {
	if (typeof window !== "undefined") {
		window.sessionStorage.removeItem(INVITATION_TOKEN_SESSION_KEY);
	}
}
