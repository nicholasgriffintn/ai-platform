import { createContext, useContext, useEffect } from "react";

export interface AppChrome {
  backHref: string;
  backLabel: string;
  setOwnsChrome: (ownsChrome: boolean) => void;
}

const AppChromeContext = createContext<AppChrome | null>(null);

export const AppChromeProvider = AppChromeContext.Provider;

export function useAppChrome(): AppChrome | null {
  return useContext(AppChromeContext);
}

export function useOwnAppChrome(ownsChrome: boolean): AppChrome | null {
  const chrome = useAppChrome();
  const setOwnsChrome = chrome?.setOwnsChrome;

  useEffect(() => {
    if (!setOwnsChrome) {
      return;
    }

    setOwnsChrome(ownsChrome);

    return () => setOwnsChrome(false);
  }, [ownsChrome, setOwnsChrome]);

  return chrome;
}
