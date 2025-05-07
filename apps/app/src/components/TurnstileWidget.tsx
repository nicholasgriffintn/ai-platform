import { useEffect, useRef } from "react";
import { TURNSTILE_SITE_KEY } from "~/constants";
import { useChatStore } from "~/state/stores/chatStore";

declare global {
  interface Window {
    turnstileCallback: (token: string) => void;
  }
}

export function TurnstileWidget() {
  const { setTurnstileToken } = useChatStore();
  const widgetRef = useRef<HTMLDivElement>(null);
  const scriptLoadedRef = useRef(false);

  useEffect(() => {
    if (scriptLoadedRef.current || !TURNSTILE_SITE_KEY) {
      return;
    }

    const loadTurnstileScript = () => {
      if (document.querySelector('script[src*="turnstile/v0/api.js"]')) {
        scriptLoadedRef.current = true;
        return;
      }

      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
      scriptLoadedRef.current = true;
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
    };
  }, [setTurnstileToken]);

  if (!TURNSTILE_SITE_KEY) {
    return null;
  }

  return (
    <div
      ref={widgetRef}
      className="cf-turnstile"
      data-sitekey={TURNSTILE_SITE_KEY}
      data-callback="turnstileCallback"
    />
  );
}
