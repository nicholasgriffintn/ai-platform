import { MAGIC_LINK_EXPIRATION_MINUTES } from "~/constants/app";
import { sendEmail } from "~/services/email";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "NOTIFICATIONS" });

interface EmailTemplate {
  subject: string;
  title: string;
  content: string;
  footer?: string;
  userName?: string;
}

function createEmailTemplate({
  subject,
  title,
  content,
  footer,
  userName,
}: EmailTemplate): { subject: string; bodyText: string; bodyHtml: string } {
  const greeting = userName ? `Hello ${userName}!` : "Hello!";
  const titleWithGreeting = `${greeting}\n\n${title}`;

  const bodyText = `${greeting}\n\n${title}\n\n${content}${footer ? `\n\n${footer}` : ""}`;

  const bodyHtml = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${subject}</title>
    <!--[if mso]>
    <noscript>
        <xml>
            <o:OfficeDocumentSettings>
                <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
    </noscript>
    <![endif]-->
    <style type="text/css">
        /* Reset styles */
        body, table, td, p, a, li, blockquote {
            -webkit-text-size-adjust: 100%;
            -ms-text-size-adjust: 100%;
        }
        table, td {
            mso-table-lspace: 0pt;
            mso-table-rspace: 0pt;
        }
        img {
            -ms-interpolation-mode: bicubic;
            border: 0;
            height: auto;
            line-height: 100%;
            outline: none;
            text-decoration: none;
        }
        
        /* Mobile styles */
        @media only screen and (max-width: 600px) {
            .mobile-center {
                text-align: center !important;
            }
            .mobile-padding {
                padding: 20px !important;
            }
            .mobile-font-size {
                font-size: 16px !important;
                line-height: 24px !important;
            }
            .mobile-button {
                width: 100% !important;
                max-width: 280px !important;
            }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
    <!-- Wrapper Table -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f4;">
        <tr>
            <td align="center" style="padding: 20px 0;">
                
                <!-- Main Container -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); max-width: 600px; width: 100%;">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background-color: #fff; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td align="center">
                                        <img src="https://polychat.app/logos/abstract.svg" alt="Polychat Logo" width="150" height="50" style="display: block; max-width: 150px; height: auto;" />
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Main Content -->
                    <tr>
                        <td style="padding: 40px 30px;" class="mobile-padding">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                
                                <!-- Greeting -->
                                <tr>
                                    <td style="padding-bottom: 20px;">
                                        <h1 style="margin: 0; font-size: 28px; line-height: 36px; color: #1f2937; font-weight: bold;" class="mobile-font-size">
                                          ${titleWithGreeting}
                                        </h1>
                                    </td>
                                </tr>
                                
                                <!-- Main Message -->
                                <tr>
                                    <td style="padding-bottom: 30px;">
                                        <div style="font-size: 16px; line-height: 24px; color: #4b5563;">
                                            ${content}
                                        </div>
                                    </td>
                                </tr>
                                
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td align="center" style="padding-bottom: 10px;">
                                        <p style="margin: 0; font-size: 14px; line-height: 20px; color: #6b7280;">
                                            ${footer || "Thank you for using Polychat!"}
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                </table>
                
            </td>
        </tr>
    </table>
</body>
</html>`;

  return { subject, bodyText, bodyHtml };
}

// Subscription Notifications
export async function sendSubscriptionEmail(
  env: IEnv,
  email: string,
  planName: string,
): Promise<void> {
  const template = createEmailTemplate({
    subject: "Subscription Confirmation",
    title: "Your Subscription has been Confirmed",
    content: `
      <p>Thank you for subscribing to the ${planName} plan!</p>
      <p>Your account has been upgraded and you now have access to all premium features.</p>
      <p>If you have any questions about your subscription, please contact our support team.</p>
    `,
  });

  try {
    await sendEmail(
      env,
      email,
      template.subject,
      template.bodyText,
      template.bodyHtml,
    );
    logger.info(`Subscription confirmation email sent to ${email}`);
  } catch (error) {
    logger.error(
      `Failed to send subscription confirmation email to ${email}:`,
      { error },
    );
    throw error;
  }
}

export async function sendUnsubscriptionEmail(
  env: IEnv,
  email: string,
): Promise<void> {
  const template = createEmailTemplate({
    subject: "Subscription Cancelled",
    title: "Your Subscription has been Cancelled",
    content: `
      <p>We're sorry to see you go. Your subscription has been cancelled.</p>
      <p>Your account has been downgraded to the free plan. You'll continue to have access to basic features.</p>
      <p>If you change your mind, you can resubscribe at any time from your account settings.</p>
    `,
  });

  try {
    await sendEmail(
      env,
      email,
      template.subject,
      template.bodyText,
      template.bodyHtml,
    );
    logger.info(`Subscription cancellation email sent to ${email}`);
  } catch (error) {
    logger.error(
      `Failed to send subscription cancellation email to ${email}:`,
      { error },
    );
    throw error;
  }
}

export async function sendSubscriptionCancellationNoticeEmail(
  env: IEnv,
  email: string,
): Promise<void> {
  const template = createEmailTemplate({
    subject: "Your Subscription Will End Soon",
    title: "Your Subscription Will End Soon",
    content: `
      <p>Your subscription has been set to cancel at the end of your current billing period.</p>
      <p>You can continue to enjoy all premium features until that time.</p>
      <p>If you change your mind, you can reactivate your subscription from your account settings.</p>
    `,
  });

  try {
    await sendEmail(
      env,
      email,
      template.subject,
      template.bodyText,
      template.bodyHtml,
    );
    logger.info(`Subscription cancellation notice email sent to ${email}`);
  } catch (error) {
    logger.error(
      `Failed to send subscription cancellation notice email to ${email}:`,
      { error },
    );
    throw error;
  }
}

export async function sendPaymentFailedEmail(
  env: IEnv,
  email: string,
): Promise<void> {
  const template = createEmailTemplate({
    subject: "Payment Failed",
    title: "Your Payment has Failed",
    content: `
      <p>Your payment has failed. Please update your payment method to continue using Polychat.</p>
    `,
  });

  try {
    await sendEmail(
      env,
      email,
      template.subject,
      template.bodyText,
      template.bodyHtml,
    );
    logger.info(`Payment failed email sent to ${email}`);
  } catch (error) {
    logger.error(`Failed to send payment failed email: ${error}`);
    throw error;
  }
}

export async function sendTrialEndingEmail(
  env: IEnv,
  email: string,
): Promise<void> {
  const template = createEmailTemplate({
    subject: "Your Trial is Ending Soon",
    title: "Your Free Trial is Ending Soon",
    content: `
      <p>Your free trial period is ending soon.</p>
      <p>To continue enjoying premium features without interruption, please make sure your payment method is up to date.</p>
      <p>If you do not update your payment method, your account will be downgraded to the free plan when your trial expires.</p>
    `,
  });

  try {
    await sendEmail(
      env,
      email,
      template.subject,
      template.bodyText,
      template.bodyHtml,
    );
    logger.info(`Trial ending notification email sent to ${email}`);
  } catch (error) {
    logger.error(`Failed to send trial ending notification email: ${error}`);
    throw error;
  }
}

// Agent Notifications
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

  const template = createEmailTemplate({
    subject,
    title: `Your Agent ${isApproved ? "has been Approved" : "Requires Changes"} ${statusEmoji}`,
    content: `
      <p><strong>Your agent "${agentName}" has been ${status} for the Polychat marketplace.</strong></p>
      ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
      ${
        isApproved
          ? "<p>🎉 Your agent is now live and available for other users to discover and install!</p>"
          : "<p>Please review the feedback and make any necessary changes, then resubmit your agent.</p>"
      }
      ${moderatorName ? `<p><em>Reviewed by: ${moderatorName}</em></p>` : ""}
    `,
    footer: "Best regards,<br>The Polychat Team",
    userName,
  });

  try {
    await sendEmail(
      env,
      userEmail,
      template.subject,
      template.bodyText,
      template.bodyHtml,
    );
    logger.info(
      `Sent moderation notification to ${userEmail} for agent ${agentName}`,
    );
  } catch (error) {
    logger.error(
      `Failed to send moderation notification to ${userEmail}:`,
      error,
    );
    throw error;
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

  const template = createEmailTemplate({
    subject,
    title: "🌟 Your Agent has been Featured!",
    content: `
      <p><strong>🎉 Congratulations! Your agent "${agentName}" has been selected as a featured agent on the Polychat marketplace.</strong></p>
      <p>Featured agents get premium placement and increased visibility to help more users discover your creation.</p>
      ${moderatorName ? `<p><em>Selected by: ${moderatorName}</em></p>` : ""}
      <p><strong>Keep up the great work!</strong></p>
    `,
    footer: "Best regards,<br>The Polychat Team",
    userName,
  });

  try {
    await sendEmail(
      env,
      userEmail,
      template.subject,
      template.bodyText,
      template.bodyHtml,
    );
    logger.info(
      `Sent featured notification to ${userEmail} for agent ${agentName}`,
    );
  } catch (error) {
    logger.error(
      `Failed to send featured notification to ${userEmail}:`,
      error,
    );
    throw error;
  }
}

// Authentication Notifications
export async function sendMagicLinkEmail(
  env: IEnv,
  email: string,
  magicLink: string,
): Promise<void> {
  const template = createEmailTemplate({
    subject: "Login to Polychat",
    title: "Here's your login link",
    content: `
      <p>Click the button below to securely log in to your account:</p>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" class="mobile-button" style="margin: 20px 0;">
        <tr>
          <td align="center" style="background-color: #2563eb; border-radius: 6px;">
            <a href="${magicLink}" style="display: inline-block; padding: 16px 32px; font-size: 16px; font-weight: bold; color: #ffffff; text-decoration: none; border-radius: 6px;">
              Log In to Polychat
            </a>
          </td>
        </tr>
      </table>
      <p>If you didn't request this login link, you can safely ignore this email.</p>
      <p><strong>This link will expire in ${MAGIC_LINK_EXPIRATION_MINUTES} minutes.</strong></p>
    `,
    footer: "For security reasons, please don't share this link with anyone.",
  });

  try {
    await sendEmail(
      env,
      email,
      template.subject,
      template.bodyText,
      template.bodyHtml,
    );
    logger.info(`Magic link email sent to ${email}`);
  } catch (error) {
    logger.error("Failed to send magic link email:", { error });
    throw new AssistantError(
      `Failed to send magic link: ${error}`,
      ErrorType.EMAIL_SEND_FAILED,
    );
  }
}
