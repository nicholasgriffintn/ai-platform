import { type ReactNode, createContext, useContext, useState } from "react";

export type ErrorSeverity = "error" | "warning" | "info";

export interface ErrorMessage {
  id: string;
  message: string;
  severity: ErrorSeverity;
  timestamp: number;
}

interface ErrorContextType {
  errors: ErrorMessage[];
  addError: (message: string, severity?: ErrorSeverity) => void;
  removeError: (id: string) => void;
  clearErrors: () => void;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

export function ErrorProvider({ children }: { children: ReactNode }) {
  const [errors, setErrors] = useState<ErrorMessage[]>([]);

  const addError = (message: string, severity: ErrorSeverity = "error") => {
    const newError: ErrorMessage = {
      id: crypto.randomUUID(),
      message,
      severity,
      timestamp: Date.now(),
    };
    setErrors((prev) => [...prev, newError]);

    setTimeout(() => {
      removeError(newError.id);
    }, 5000);
  };

  const removeError = (id: string) => {
    setErrors((prev) => prev.filter((error) => error.id !== id));
  };

  const clearErrors = () => {
    setErrors([]);
  };

  return (
    <ErrorContext.Provider
      value={{ errors, addError, removeError, clearErrors }}
    >
      {children}
    </ErrorContext.Provider>
  );
}

export function useError() {
  const context = useContext(ErrorContext);

  if (context === undefined) {
    throw new Error("useError must be used within an ErrorProvider");
  }

  return context;
}
