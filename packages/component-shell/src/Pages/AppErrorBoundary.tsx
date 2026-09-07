import { shouldShowDevTools } from "@ngriffin_uk/polychat-library-client";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { useLocation } from "react-router";

import { ErrorPage } from "./ErrorPage";

interface ErrorBoundaryViewProps {
  children: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
  resetKey: string;
}

interface ErrorBoundaryViewState {
  error: Error | null;
  resetKey: string;
}

class ErrorBoundaryView extends Component<ErrorBoundaryViewProps, ErrorBoundaryViewState> {
  constructor(props: ErrorBoundaryViewProps) {
    super(props);
    this.state = { error: null, resetKey: props.resetKey };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryViewState> {
    return { error };
  }

  static getDerivedStateFromProps(
    props: ErrorBoundaryViewProps,
    state: ErrorBoundaryViewState,
  ): Partial<ErrorBoundaryViewState> | null {
    return props.resetKey === state.resetKey ? null : { error: null, resetKey: props.resetKey };
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

export function AppErrorBoundary({
  children,
  onError,
}: {
  children: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}) {
  const { pathname } = useLocation();

  return (
    <ErrorBoundaryView resetKey={pathname} onError={onError}>
      {children}
    </ErrorBoundaryView>
  );
}
