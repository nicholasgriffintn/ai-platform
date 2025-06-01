import { useEffect, useState } from "react";

import { useTrackEvent } from "~/hooks/use-track-event";

interface HCaptchaProps {
  siteKey: string;
  onVerify: (token: string) => void;
}

declare global {
  interface Window {
    hcaptcha: {
      render: (container: string | HTMLElement, params: any) => number;
      execute: (widgetId?: number) => void;
      reset: (widgetId?: number) => void;
      remove: (widgetId?: number) => void;
    };
  }
}

export const HCaptchaVerifier = ({ siteKey, onVerify }: HCaptchaProps) => {
  const [widgetId, setWidgetId] = useState<number | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  const trackEvent = useTrackEvent();

  // biome-ignore lint/correctness/useExhaustiveDependencies: We don't need to use widgetId in this effect
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (document.querySelector('script[src*="hcaptcha.com/1/api.js"]')) {
      setIsLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://js.hcaptcha.com/1/api.js";
    script.async = true;
    script.defer = true;

    script.onload = () => {
      setIsLoaded(true);
    };

    document.head.appendChild(script);

    return () => {
      if (widgetId !== null && window.hcaptcha) {
        window.hcaptcha.remove(widgetId);
      }
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: We don't need to use widgetId in this effect
  useEffect(() => {
    if (
      !isLoaded ||
      typeof window === "undefined" ||
      !window.hcaptcha ||
      isVerified
    )
      return;

    const id = window.hcaptcha.render("hcaptcha-container", {
      sitekey: siteKey,
      size: "invisible",
      callback: (token: string) => {
        onVerify(token);
        setIsVerified(true);
        trackEvent({
          name: "captcha_verified",
          category: "hcaptcha",
          nonInteraction: true,
        });
      },
      "error-callback": () => {
        console.error("HCaptcha verification failed");
        trackEvent({
          name: "captcha_verification_failed",
          category: "hcaptcha",
          nonInteraction: true,
        });
      },
      "expired-callback": () => {
        setIsVerified(false);
        if (window.hcaptcha && widgetId !== null) {
          window.hcaptcha.execute(widgetId);
        }
        trackEvent({
          name: "captcha_expired",
          category: "hcaptcha",
          nonInteraction: true,
        });
      },
    });

    setWidgetId(id);

    if (window.hcaptcha && id !== null) {
      window.hcaptcha.execute(id);
    }
  }, [isLoaded, siteKey, onVerify, isVerified]);

  return <div id="hcaptcha-container" style={{ display: "none" }} />;
};
