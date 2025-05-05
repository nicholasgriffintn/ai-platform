import {
  type ReactNode,
  createContext,
  useContext,
  useMemo,
  useState,
} from "react";

interface LoadingState {
  id: string;
  message?: string;
  progress?: number;
}

interface LoadingStateContextType {
  loadingStates: LoadingState[];
}

interface LoadingActionsContextType {
  startLoading: (id: string, message?: string) => void;
  updateLoading: (id: string, progress?: number, message?: string) => void;
  stopLoading: (id: string) => void;
}

const LoadingStateContext = createContext<LoadingStateContextType | undefined>(
  undefined,
);
const LoadingActionsContext = createContext<
  LoadingActionsContextType | undefined
>(undefined);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [loadingStates, setLoadingStates] = useState<LoadingState[]>([]);

  const actions = useMemo(() => {
    const startLoading = (id: string, message?: string) => {
      setLoadingStates((prev) => {
        const existingIndex = prev.findIndex((state) => state.id === id);
        if (existingIndex >= 0 && prev[existingIndex].message === message) {
          return prev;
        }

        return [...prev.filter((state) => state.id !== id), { id, message }];
      });
    };

    const updateLoading = (id: string, progress?: number, message?: string) => {
      setLoadingStates((prev) => {
        const existingState = prev.find((state) => state.id === id);
        if (
          existingState?.progress === progress &&
          (message === undefined || existingState?.message === message)
        ) {
          return prev;
        }

        return prev.map((state) =>
          state.id === id
            ? { ...state, progress, message: message ?? state.message }
            : state,
        );
      });
    };

    const stopLoading = (id: string) => {
      setLoadingStates((prev) => {
        if (!prev.some((state) => state.id === id)) {
          return prev;
        }
        return prev.filter((state) => state.id !== id);
      });
    };

    return {
      startLoading,
      updateLoading,
      stopLoading,
    };
  }, []);

  const stateValue = useMemo(() => ({ loadingStates }), [loadingStates]);

  return (
    <LoadingActionsContext.Provider value={actions}>
      <LoadingStateContext.Provider value={stateValue}>
        {children}
      </LoadingStateContext.Provider>
    </LoadingActionsContext.Provider>
  );
}

export function useLoadingActions() {
  const context = useContext(LoadingActionsContext);
  if (context === undefined) {
    throw new Error("useLoadingActions must be used within a LoadingProvider");
  }
  return context;
}

export function useLoadingStates() {
  const context = useContext(LoadingStateContext);
  if (context === undefined) {
    throw new Error("useLoadingStates must be used within a LoadingProvider");
  }
  return context.loadingStates;
}

export function useIsLoading(id: string) {
  const loadingStates = useLoadingStates();
  return useMemo(
    () => loadingStates.some((state) => state.id === id),
    [loadingStates, id],
  );
}

export function useLoadingProgress(id: string) {
  const loadingStates = useLoadingStates();
  return useMemo(
    () => loadingStates.find((state) => state.id === id)?.progress,
    [loadingStates, id],
  );
}

export function useLoadingMessage(id: string) {
  const loadingStates = useLoadingStates();
  return useMemo(
    () => loadingStates.find((state) => state.id === id)?.message,
    [loadingStates, id],
  );
}
