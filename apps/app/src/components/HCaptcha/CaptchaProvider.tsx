import { Suspense, lazy, useEffect } from "react";

import { CAPTCHA_SITE_KEY, shouldEnableCaptcha } from "~/constants";
import { useCaptchaStore } from "~/state/stores/captchaStore";

const HCaptchaVerifierLazy = lazy(() =>
  import("./HCaptchaVerifier").then((d) => ({
    default: d.HCaptchaVerifier,
  })),
);

export const CaptchaProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
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
      {shouldEnableCaptcha() && (
        <Suspense fallback={null}>
          <HCaptchaVerifierLazy
            siteKey={CAPTCHA_SITE_KEY}
            onVerify={handleVerify}
          />
        </Suspense>
      )}
    </>
  );
};
