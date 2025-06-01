import { useEffect, useState } from "react";

import { EventCategory, useTrackEvent } from "~/hooks/use-track-event";
import { useChatStore } from "~/state/stores/chatStore";

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
  const { isAuthenticated } = useChatStore();

  const { trackEvent, trackAuth, trackError } = useTrackEvent();

  useEffect(() => {
    if (isAuthenticated && !isVerified) {
      trackAuth("captcha_bypassed", {
        reason: "authenticated_user",
        site_key: siteKey,
      });
      onVerify("authenticated-user");
      setIsVerified(true);
      return;
    }

    if (isAuthenticated) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    if (!isLoaded) {
      const existingScript = document.querySelector(
        'script[src*="hcaptcha.com/1/api.js"]',
      );
      if (existingScript) {
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
      return;
    }

    if (isLoaded && !isVerified && window.hcaptcha) {
      const id = window.hcaptcha.render("hcaptcha-container", {
        sitekey: siteKey,
        size: "invisible",
        callback: (token: string) => {
          onVerify(token);
          setIsVerified(true);
          trackAuth("captcha_verified", {
            verification_method: "hcaptcha",
            site_key: siteKey,
          });
        },
        "error-callback": () => {
          console.error("HCaptcha verification failed");
          trackError(
            "captcha_verification_failed",
            new Error("HCaptcha verification failed"),
            {
              verification_method: "hcaptcha",
              site_key: siteKey,
            },
          );
        },
        "expired-callback": () => {
          setIsVerified(false);
          if (window.hcaptcha && widgetId !== null) {
            window.hcaptcha.execute(widgetId);
          }
          trackEvent({
            name: "captcha_expired",
            category: EventCategory.AUTH,
            nonInteraction: true,
            properties: {
              verification_method: "hcaptcha",
              site_key: siteKey,
            },
          });
        },
      });

      setWidgetId(id);

      if (window.hcaptcha && id !== null) {
        window.hcaptcha.execute(id);
      }
    }

    return () => {
      if (widgetId !== null && window.hcaptcha) {
        window.hcaptcha.remove(widgetId);
      }
    };
  }, [
    isAuthenticated,
    isLoaded,
    isVerified,
    onVerify,
    siteKey,
    trackEvent,
    widgetId,
    trackAuth,
    trackError,
  ]);

  return <div id="hcaptcha-container" style={{ display: "none" }} />;
};
