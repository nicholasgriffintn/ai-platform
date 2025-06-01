import { useCallback, useEffect, useRef, useState } from "react";

import { EventCategory, useTrackEvent } from "~/hooks/use-track-event";

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
    hcaptchaOnLoad?: () => void;
  }
}

export const HCaptchaVerifier = ({ siteKey, onVerify }: HCaptchaProps) => {
  const [widgetId, setWidgetId] = useState<number | null>(null);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const captchaInitialized = useRef(false);

  const { trackEvent, trackAuth, trackError } = useTrackEvent();

  const initializeCaptcha = useCallback(() => {
    if (
      !window.hcaptcha ||
      !containerRef.current ||
      captchaInitialized.current ||
      isVerified
    ) {
      return;
    }

    captchaInitialized.current = true;
    const id = window.hcaptcha.render(containerRef.current, {
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
  }, [
    isVerified,
    onVerify,
    siteKey,
    trackAuth,
    trackError,
    trackEvent,
    widgetId,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!window.hcaptchaOnLoad) {
      window.hcaptchaOnLoad = () => {
        setIsScriptLoaded(true);
      };
    }

    const existingScript = document.querySelector(
      'script[src*="hcaptcha.com/1/api.js"]',
    );

    if (existingScript) {
      setIsScriptLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src =
      "https://js.hcaptcha.com/1/api.js?render=explicit&onload=hcaptchaOnLoad";
    script.async = true;
    script.defer = true;

    document.head.appendChild(script);

    return () => {};
  }, []);

  useEffect(() => {
    if (
      isScriptLoaded &&
      !isVerified &&
      window.hcaptcha &&
      containerRef.current &&
      !captchaInitialized.current
    ) {
      const timer = setTimeout(() => {
        initializeCaptcha();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [initializeCaptcha, isScriptLoaded, isVerified]);

  useEffect(() => {
    return () => {
      if (widgetId !== null && window.hcaptcha) {
        window.hcaptcha.remove(widgetId);
      }
    };
  }, [widgetId]);

  return (
    <div ref={containerRef} data-hcaptcha={true} style={{ display: "none" }} />
  );
};
