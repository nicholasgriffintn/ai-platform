import { createContext, useContext } from "react";

export interface AppChrome {
  backHref?: string;
  backLabel?: string;
}

const AppChromeContext = createContext<AppChrome | null>(null);

export const AppChromeProvider = AppChromeContext.Provider;

export function useAppChrome(): AppChrome | null {
  return useContext(AppChromeContext);
}

export function useOwnAppChrome(ownsChrome: boolean): AppChrome | null {
  void ownsChrome;

  return useAppChrome();
}
