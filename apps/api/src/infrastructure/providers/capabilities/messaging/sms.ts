export const SMS_MAX_LENGTH = 1500;

export function trimSmsBody(body: string): string {
  return body.length > SMS_MAX_LENGTH ? `${body.slice(0, SMS_MAX_LENGTH - 1)}...` : body;
}
