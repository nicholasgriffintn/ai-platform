import type { Context } from "hono";

import { sendEmail } from "~/services/email";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "SUBSCRIPTION_EMAILS" });

export async function sendSubscriptionEmail(
  context: Context,
  email: string,
  planName: string,
): Promise<void> {
  const subject = "Subscription Confirmation";
  const bodyText = `Thank you for subscribing to the ${planName} plan!`;

  const bodyHtml = `
    <html>
      <head></head>
      <body>
        <h1>Subscription Confirmed</h1>
        <p>Thank you for subscribing to the ${planName} plan!</p>
        <p>Your account has been upgraded and you now have access to all premium features.</p>
        <p>If you have any questions about your subscription, please contact our support team.</p>
      </body>
    </html>
  `;

  try {
    await sendEmail(context, email, subject, bodyText, bodyHtml);
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
  context: Context,
  email: string,
): Promise<void> {
  const subject = "Subscription Cancelled";
  const bodyText = `We're sorry to see you go. Your subscription has been cancelled.`;

  const bodyHtml = `
    <html>
      <head></head>
      <body>
        <h1>Subscription Cancelled</h1>
        <p>We're sorry to see you go. Your subscription has been cancelled.</p>
        <p>Your account has been downgraded to the free plan. You'll continue to have access to basic features.</p>
        <p>If you change your mind, you can resubscribe at any time from your account settings.</p>
      </body>
    </html>
  `;

  try {
    await sendEmail(context, email, subject, bodyText, bodyHtml);
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
  context: Context,
  email: string,
): Promise<void> {
  const subject = "Your Subscription Will End Soon";
  const bodyText =
    "Your subscription will be canceled at the end of your current billing period.";

  const bodyHtml = `
    <html>
      <head></head>
      <body>
        <h1>Subscription Will End Soon</h1>
        <p>Your subscription has been set to cancel at the end of your current billing period.</p>
        <p>You can continue to enjoy all premium features until that time.</p>
        <p>If you change your mind, you can reactivate your subscription from your account settings.</p>
      </body>
    </html>
  `;

  try {
    await sendEmail(context, email, subject, bodyText, bodyHtml);
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
  context: Context,
  email: string,
): Promise<void> {
  const subject = "Payment Failed";
  const bodyText =
    "Your payment has failed. Please update your payment method to continue using Polychat.";

  const bodyHtml = `
    <html>
      <head></head>
      <body>
        <h1>Payment Failed</h1>
        <p>Your payment has failed. Please update your payment method to continue using Polychat.</p>
      </body>
    </html>
  `;

  try {
    await sendEmail(context, email, subject, bodyText, bodyHtml);
    logger.info(`Payment failed email sent to ${email}`);
  } catch (error) {
    logger.error(`Failed to send payment failed email: ${error}`);
    throw error;
  }
}

export async function sendTrialEndingEmail(
  context: Context,
  email: string,
): Promise<void> {
  const subject = "Your Trial is Ending Soon";
  const bodyText =
    "Your free trial period is ending soon. To continue using premium features, please update your payment method.";

  const bodyHtml = `
    <html>
      <head></head>
      <body>
        <h1>Your Trial is Ending Soon</h1>
        <p>Your free trial period is ending soon.</p>
        <p>To continue enjoying premium features without interruption, please make sure your payment method is up to date.</p>
        <p>If you do not update your payment method, your account will be downgraded to the free plan when your trial expires.</p>
      </body>
    </html>
  `;

  try {
    await sendEmail(context, email, subject, bodyText, bodyHtml);
    logger.info(`Trial ending notification email sent to ${email}`);
  } catch (error) {
    logger.error(`Failed to send trial ending notification email: ${error}`);
    throw error;
  }
}
