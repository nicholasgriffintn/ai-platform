import { AwsClient } from "aws4fetch";

import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import type { IEnv } from "../../types";

const logger = getLogger({ prefix: "services/email" });

export async function sendEmail(
  env: IEnv,
  email: string,
  subject: string,
  bodyText: string,
  bodyHtml: string,
): Promise<void> {
  const { AWS_SES_ACCESS_KEY_ID, AWS_SES_SECRET_ACCESS_KEY, SES_EMAIL_FROM } =
    env;

  if (!AWS_SES_ACCESS_KEY_ID || !AWS_SES_SECRET_ACCESS_KEY || !SES_EMAIL_FROM) {
    throw new AssistantError(
      "AWS SES configuration missing",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  const awsClient = new AwsClient({
    accessKeyId: AWS_SES_ACCESS_KEY_ID,
    secretAccessKey: AWS_SES_SECRET_ACCESS_KEY,
    region: "us-east-1",
  });

  const requestBody = JSON.stringify({
    FromEmailAddress: SES_EMAIL_FROM,
    Destination: {
      ToAddresses: [email],
    },
    Content: {
      Simple: {
        Subject: {
          Data: subject,
          Charset: "UTF-8",
        },
        Body: {
          Text: {
            Data: bodyText,
            Charset: "UTF-8",
          },
          Html: {
            Data: bodyHtml,
            Charset: "UTF-8",
          },
        },
      },
    },
  });

  const contentLength = new TextEncoder().encode(requestBody).length;

  const request = new Request(
    "https://email.us-east-1.amazonaws.com/v2/email/outbound-emails",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": contentLength.toString(),
      },
      body: requestBody,
    },
  );

  try {
    const signedRequest = await awsClient.sign(request);
    const response = await fetch(signedRequest);

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error("SES error response:", errorBody);
      throw new Error(`Failed to send email: ${response.statusText}`);
    }
    logger.info(`Email sent to ${email}`);
  } catch (error: any) {
    logger.error("Failed to send email:", { error });
    throw new AssistantError(
      `Failed to send email: ${error.message}`,
      ErrorType.EMAIL_SEND_FAILED,
    );
  }
}
