import { type ComponentType, createContext, type ReactNode, useContext } from "react";

export interface ShellHost {
  webBaseUrl: string;
  openAssistant: () => void;
  openSignIn: () => void;
  signOut: () => void;
  HostDialogs?: ComponentType;
}

const ShellHostContext = createContext<ShellHost | null>(null);

export function ShellHostProvider({ children, host }: { children: ReactNode; host: ShellHost }) {
  return <ShellHostContext.Provider value={host}>{children}</ShellHostContext.Provider>;
}

export function useShellHost(): ShellHost {
  const host = useContext(ShellHostContext);

  if (!host) {
    throw new Error("useShellHost must be used within a ShellHostProvider");
  }

  return host;
}
