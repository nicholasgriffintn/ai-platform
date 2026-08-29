import { createContext, useContext, type ReactNode } from "react";

const EMPTY: ReadonlySet<string> = new Set<string>();

const ResolvedToolCallsContext = createContext<ReadonlySet<string>>(EMPTY);

export function ResolvedToolCallsProvider({
  resolvedToolCallIds,
  children,
}: {
  resolvedToolCallIds: ReadonlySet<string>;
  children: ReactNode;
}) {
  return (
    <ResolvedToolCallsContext.Provider value={resolvedToolCallIds}>
      {children}
    </ResolvedToolCallsContext.Provider>
  );
}

export function useResolvedToolCallIds(): ReadonlySet<string> {
  return useContext(ResolvedToolCallsContext);
}
