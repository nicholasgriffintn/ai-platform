import { useEffect } from "react";
import { CAPTCHA_SITE_KEY } from "~/constants";
import { useCaptchaStore } from "~/state/stores/captchaStore";
import { HCaptchaVerifier } from ".";

export const CaptchaProvider = ({
  children,
}: { children: React.ReactNode }) => {
  const { captchaToken, setCaptchaToken, setIsVerified } = useCaptchaStore();

  const handleVerify = (token: string) => {
    setCaptchaToken(token);
    setIsVerified(true);
  };

  useEffect(() => {
    if (!captchaToken) {
      setIsVerified(false);
    }
  }, [captchaToken, setIsVerified]);

  if (!CAPTCHA_SITE_KEY) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      <HCaptchaVerifier siteKey={CAPTCHA_SITE_KEY} onVerify={handleVerify} />
    </>
  );
};
