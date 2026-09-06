import {
  Button,
  LoadingSpinner,
  PetPreview,
  textLinkClassName,
} from "@ngriffin_uk/polychat-component-ui";
import { APP_NAME } from "@ngriffin_uk/polychat-library-client";
import { resolvePet } from "@ngriffin_uk/polychat-schemas";
import { CloudOff, Laptop, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

export interface WelcomeScreenHighlight {
  icon: ReactNode;
  title: string;
  detail: string;
}

export interface WelcomeScreenProps {
  isChecking?: boolean;
  checkingMessage?: string;
  error?: string | null;
  highlights?: WelcomeScreenHighlight[];
  isSigningIn?: boolean;
  onSignIn: () => void;
  strapline?: string;
  termsHref?: string;
  privacyHref?: string;
}

export const DESKTOP_WELCOME_HIGHLIGHTS: WelcomeScreenHighlight[] = [
  {
    icon: <Sparkles className="size-4 text-accent-violet" aria-hidden="true" />,
    title: "Every model, one account",
    detail: "The same catalogue, plans and teammates you have on the web.",
  },
  {
    icon: <Laptop className="size-4 text-accent-teal" aria-hidden="true" />,
    title: "Models on this machine",
    detail: "Ollama and LM Studio answer from here, and only from here.",
  },
  {
    icon: <CloudOff className="size-4 text-accent-amber" aria-hidden="true" />,
    title: "Temporary stays temporary",
    detail: "Chats sync unless you mark them temporary, which never leave the device.",
  },
];

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
  highlights = DESKTOP_WELCOME_HIGHLIGHTS,
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

      <ul className="mt-8 w-full space-y-3 text-left">
        {highlights.map((highlight) => (
          <li
            key={highlight.title}
            className="flex gap-3 rounded-xl border border-border bg-surface px-4 py-3"
          >
            <span className="mt-0.5 shrink-0">{highlight.icon}</span>
            <span>
              <span className="block text-sm font-medium text-foreground">{highlight.title}</span>
              <span className="block text-sm text-muted-foreground">{highlight.detail}</span>
            </span>
          </li>
        ))}
      </ul>

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
