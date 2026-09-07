import { SignInEmptyState as ControlledSignInEmptyState } from "@ngriffin_uk/polychat-component-ui";
import type { ReactNode } from "react";

import { useShellHost } from "../Host/ShellHostContext.js";

interface SignInEmptyStateProps {
  title?: ReactNode;
  message?: string;
  className?: string;
}

export function SignInEmptyState(props: SignInEmptyStateProps) {
  const { openSignIn } = useShellHost();

  return <ControlledSignInEmptyState {...props} onSignIn={openSignIn} />;
}
