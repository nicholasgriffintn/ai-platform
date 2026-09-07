import {
  Button,
  LoadingSpinner,
  PetPreview,
  textLinkClassName,
} from "@ngriffin_uk/polychat-component-ui";
import { APP_NAME } from "@ngriffin_uk/polychat-library-client";
import { resolvePet } from "@ngriffin_uk/polychat-schemas";
import type { ReactNode } from "react";

export interface WelcomeScreenProps {
  isChecking?: boolean;
  checkingMessage?: string;
  error?: string | null;
  isSigningIn?: boolean;
  onSignIn: () => void;
  strapline?: string;
  termsHref?: string;
  privacyHref?: string;
}

function WelcomeFrame({ children }: { children: ReactNode }) {
  const pet = resolvePet(undefined);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-6 py-12">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <PetPreview sheetUrl={pet.sheetUrl} layout={pet.layout} label={pet.name} size={96} />
        <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-foreground">
          {APP_NAME}
        </h1>
        {children}
      </div>
    </main>
  );
}

export function WelcomeScreen({
  isChecking = false,
  checkingMessage = "Looking for your perch",
  error,
  isSigningIn = false,
  onSignIn,
  strapline = "Sign in to bring your models, teammates and conversations to this machine.",
  termsHref = "https://polychat.app/terms",
  privacyHref = "https://polychat.app/privacy",
}: WelcomeScreenProps) {
  if (isChecking) {
    return (
      <WelcomeFrame>
        <div className="mt-8">
          <LoadingSpinner message={checkingMessage} />
        </div>
      </WelcomeFrame>
    );
  }

  return (
    <WelcomeFrame>
      <p className="mt-3 text-pretty text-muted-foreground">{strapline}</p>

      {error && (
        <p
          role="alert"
          className="mt-6 w-full rounded-md border border-failure/40 bg-failure/10 px-3 py-2 text-left text-sm text-failure"
        >
          {error}
        </p>
      )}

      <Button
        type="button"
        variant="primary"
        fullWidth
        className="mt-6"
        isLoading={isSigningIn}
        onClick={onSignIn}
      >
        Continue in your browser
      </Button>

      <p className="mt-6 text-sm text-muted-foreground">
        By continuing, you agree to our{" "}
        <a href={termsHref} className={textLinkClassName({ tone: "accent" })}>
          Terms of Service
        </a>{" "}
        and{" "}
        <a href={privacyHref} className={textLinkClassName({ tone: "accent" })}>
          Privacy Policy
        </a>
        .
      </p>
    </WelcomeFrame>
  );
}
