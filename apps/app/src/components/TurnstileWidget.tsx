import { useEffect } from "react";
import { TURNSTILE_SITE_KEY } from "~/constants";
import { useChatStore } from "~/state/stores/chatStore";

declare global {
  interface Window {
    turnstileCallback: (token: string) => void;
  }
}

export function TurnstileWidget() {
  const { setTurnstileToken } = useChatStore();

  useEffect(() => {
    const loadTurnstileScript = () => {
      if (document.querySelector('script[src*="turnstile/v0/api.js"]')) {
        return;
      }

      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    };

    if (TURNSTILE_SITE_KEY) {
      loadTurnstileScript();
    }

    window.turnstileCallback = (token: string) => {
      setTurnstileToken(token);
    };

    return () => {
      if (window.turnstileCallback) {
        window.turnstileCallback = () => {
          // Empty function to avoid errors when component unmounts
        };
      }

      const script = document.querySelector(
        'script[src*="turnstile/v0/api.js"]',
      );
      if (script) {
        document.head.removeChild(script);
      }
    };
  }, [setTurnstileToken]);

  if (!TURNSTILE_SITE_KEY) {
    return null;
  }

  return (
    <div
      className="cf-turnstile"
      data-sitekey={TURNSTILE_SITE_KEY}
      data-callback="turnstileCallback"
    />
  );
}
