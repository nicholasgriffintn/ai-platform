export interface CaptchaVerificationResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  "error-codes"?: string[];
}

export async function verifyCaptchaToken(
  token: string,
  secret: string,
  sitekey: string,
): Promise<{ verified: boolean; error?: string }> {
  try {
    const response = await fetch("https://hcaptcha.com/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        secret,
        response: token,
        sitekey,
      }),
    });

    if (!response.ok) {
      return {
        verified: false,
        error: `HTTP error ${response.status}: ${response.statusText}`,
      };
    }

    const data = (await response.json()) as CaptchaVerificationResponse;

    if (!data.success) {
      return {
        verified: false,
        error: data["error-codes"]?.join(", ") || "Unknown verification error",
      };
    }

    return { verified: true };
  } catch (error) {
    console.error("Error verifying captcha:", error);
    return {
      verified: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
