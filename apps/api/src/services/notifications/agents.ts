import { sendEmail } from "~/services/email";
import type { IEnv } from "~/types";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "NOTIFICATIONS" });

export interface AgentModerationNotification {
  agentName: string;
  agentId: string;
  isApproved: boolean;
  reason?: string;
  moderatorName?: string;
}

export interface AgentFeaturedNotification {
  agentName: string;
  agentId: string;
  isFeatured: boolean;
  moderatorName?: string;
}

export async function sendAgentModerationNotification(
  env: IEnv,
  userEmail: string,
  userName: string,
  notification: AgentModerationNotification,
): Promise<void> {
  const { agentName, isApproved, reason, moderatorName } = notification;

  const subject = isApproved
    ? `🎉 Your agent "${agentName}" has been approved for the marketplace`
    : `📝 Your agent "${agentName}" needs attention`;

  const status = isApproved ? "approved" : "requires changes";
  const statusEmoji = isApproved ? "✅" : "⚠️";

  const bodyText = `
Hi ${userName},

${statusEmoji} Your agent "${agentName}" has been ${status} for the Polychat marketplace.

${reason ? `Reason: ${reason}` : ""}

${
  isApproved
    ? "Your agent is now live and available for other users to discover and install!"
    : "Please review the feedback and make any necessary changes, then resubmit your agent."
}

${moderatorName ? `Reviewed by: ${moderatorName}` : ""}

Best regards,
The Polychat Team
  `.trim();

  const bodyHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">Agent ${isApproved ? "Approved" : "Review Required"} ${statusEmoji}</h2>
      
      <p>Hi <strong>${userName}</strong>,</p>
      
      <div style="background: ${isApproved ? "#f0f9ff" : "#fef3c7"}; border-left: 4px solid ${isApproved ? "#0ea5e9" : "#f59e0b"}; padding: 16px; margin: 20px 0;">
        <p><strong>Your agent "${agentName}" has been ${status} for the Polychat marketplace.</strong></p>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
      </div>
      
      ${
        isApproved
          ? "<p>🎉 Your agent is now live and available for other users to discover and install!</p>"
          : "<p>Please review the feedback and make any necessary changes, then resubmit your agent.</p>"
      }
      
      ${moderatorName ? `<p><small><em>Reviewed by: ${moderatorName}</em></small></p>` : ""}
      
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
      <p style="color: #6b7280; font-size: 14px;">
        Best regards,<br>
        The Polychat Team
      </p>
    </div>
  `;

  try {
    await sendEmail(env, userEmail, subject, bodyText, bodyHtml);
    logger.info(
      `Sent moderation notification to ${userEmail} for agent ${agentName}`,
    );
  } catch (error) {
    logger.error(
      `Failed to send moderation notification to ${userEmail}:`,
      error,
    );
  }
}

export async function sendAgentFeaturedNotification(
  env: IEnv,
  userEmail: string,
  userName: string,
  notification: AgentFeaturedNotification,
): Promise<void> {
  const { agentName, isFeatured, moderatorName } = notification;

  if (!isFeatured) {
    return;
  }

  const subject = `🌟 Your agent "${agentName}" has been featured!`;

  const bodyText = `
Hi ${userName},

🌟 Congratulations! Your agent "${agentName}" has been selected as a featured agent on the Polychat marketplace.

Featured agents get premium placement and increased visibility to help more users discover your creation.

${moderatorName ? `Selected by: ${moderatorName}` : ""}

Keep up the great work!

Best regards,
The Polychat Team
  `.trim();

  const bodyHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">🌟 Agent Featured!</h2>
      
      <p>Hi <strong>${userName}</strong>,</p>
      
      <div style="background: linear-gradient(135deg, #fef3c7, #fde68a); border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 8px;">
        <p><strong>🎉 Congratulations! Your agent "${agentName}" has been selected as a featured agent on the Polychat marketplace.</strong></p>
      </div>
      
      <p>Featured agents get premium placement and increased visibility to help more users discover your creation.</p>
      
      ${moderatorName ? `<p><small><em>Selected by: ${moderatorName}</em></small></p>` : ""}
      
      <p><strong>Keep up the great work!</strong></p>
      
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
      <p style="color: #6b7280; font-size: 14px;">
        Best regards,<br>
        The Polychat Team
      </p>
    </div>
  `;

  try {
    await sendEmail(env, userEmail, subject, bodyText, bodyHtml);
    logger.info(
      `Sent featured notification to ${userEmail} for agent ${agentName}`,
    );
  } catch (error) {
    logger.error(
      `Failed to send featured notification to ${userEmail}:`,
      error,
    );
  }
}
