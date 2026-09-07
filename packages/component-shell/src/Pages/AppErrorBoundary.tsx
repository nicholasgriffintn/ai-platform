import { shouldShowDevTools } from "@ngriffin_uk/polychat-library-client";
import { Component, type ErrorInfo, type ReactNode } from "react";

import { ErrorPage } from "./ErrorPage";

interface AppErrorBoundaryProps {
  children: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }

  render() {
    const { error } = this.state;

    if (!error) {
      return this.props.children;
    }

    return (
      <ErrorPage
        message="Oops! Something went wrong."
        details={error.message || "An unexpected error occurred."}
        stack={shouldShowDevTools() ? error.stack : undefined}
      />
    );
  }
}
