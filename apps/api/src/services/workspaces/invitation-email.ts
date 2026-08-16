import { sendEmail } from "~/services/email";
import type { IEnv } from "~/types";
import { escapeHtml } from "~/utils/html";

export async function sendWorkspaceInvitationEmail(
	env: IEnv,
	params: {
		email: string;
		inviteUrl: string;
		inviterName?: string | null;
		role: string;
		workspaceName: string;
	},
): Promise<void> {
	const workspaceName = escapeHtml(params.workspaceName);
	const inviterName = escapeHtml(params.inviterName?.trim() || "A workspace administrator");
	const inviteUrl = escapeHtml(params.inviteUrl);
	const subject = `You’re invited to join ${params.workspaceName} on Polychat`;
	const bodyText = [
		`You’ve been invited by ${params.inviterName?.trim() || "a workspace administrator"} to join ${params.workspaceName} on Polychat.`,
		"",
		`Role: ${params.role}`,
		"",
		`Accept the invitation: ${params.inviteUrl}`,
		"",
		"This invitation expires in 7 days and can only be accepted by the invited email address.",
	].join("\n");
	const bodyHtml = `<!doctype html>
<html lang="en">
<body style="margin:0;background:#f4f4f4;font-family:Arial,sans-serif;color:#1f2937">
  <main style="max-width:600px;margin:24px auto;background:#fff;padding:40px 32px;border-radius:8px">
    <p>Hello ${inviterName === "A workspace administrator" ? "" : "there"},</p>
    <h1>You’re invited to join ${workspaceName}</h1>
    <p>${inviterName} invited you to join this Polychat workspace as a ${escapeHtml(params.role)}.</p>
    <p><a href="${inviteUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:14px 24px;border-radius:6px;text-decoration:none;font-weight:700">Accept invitation</a></p>
    <p>This invitation expires in 7 days and can only be accepted by the invited email address.</p>
  </main>
</body>
</html>`;

	await sendEmail(env, params.email, subject, bodyText, bodyHtml);
}
