import { Github, KeySquare, Loader2, Mail } from "lucide-react";
import { useEffect, useState } from "react";

import { Button, TextInput } from "~/components/ui";
import { Dialog, DialogContent } from "~/components/ui/Dialog";
import { APP_NAME } from "~/constants";
import { useAuthStatus } from "~/hooks/useAuth";
import { usePasskeys } from "~/hooks/usePasskeys";
import { authService } from "~/lib/api/auth-service";

interface LoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onKeySubmit: () => void;
}

export const LoginModal = ({
  open,
  onOpenChange,
  onKeySubmit,
}: LoginModalProps) => {
  const [email, setEmail] = useState("");
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [isRequestingLink, setIsRequestingLink] = useState(false);
  const [error, setError] = useState("");
  const [awaitingGithubLogin, setAwaitingGithubLogin] = useState(false);
  const { isAuthenticated, isLoading, loginWithGithub } = useAuthStatus();
  const { authenticateWithPasskey, isAuthenticatingWithPasskey } =
    usePasskeys();
  const [passkeysSupported, setPasskeysSupported] = useState(false);

  useEffect(() => {
    const checkPasskeySupport = async () => {
      setPasskeysSupported(authService.isPasskeySupported());
    };
    checkPasskeySupport();
  }, []);

  useEffect(() => {
    if (isAuthenticated && open) {
      onKeySubmit();
    }
  }, [isAuthenticated, open, onKeySubmit]);

  const handleMagicLinkRequest = async () => {
    setError("");
    setEmailSubmitted(false);

    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    setIsRequestingLink(true);
    try {
      const result = await authService.requestMagicLink(email);
      if (result.success) {
        setEmailSubmitted(true);
      } else {
        setError(
          result.error || "Failed to send magic link. Please try again.",
        );
      }
    } catch (err: any) {
      setError("An unexpected error occurred. Please try again.");
      console.error("Magic link request error:", err);
    } finally {
      setIsRequestingLink(false);
    }
  };

  const handleGithubLogin = async () => {
    setAwaitingGithubLogin(true);
    await loginWithGithub();
    setAwaitingGithubLogin(false);
  };

  const handlePasskeyLogin = async () => {
    try {
      const result = await authenticateWithPasskey();
      if (result?.verified) {
        onKeySubmit();
      } else {
        setError("Passkey authentication failed");
      }
    } catch (error) {
      setError("Passkey authentication failed. Please try another method.");
      console.error("Passkey authentication error:", error);
    }
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange} width="480px">
        <DialogContent>
          <div className="flex flex-col items-center justify-center gap-4 py-8">
            <Loader2 size={32} className="animate-spin text-blue-600" />
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Checking authentication status...
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (isAuthenticated) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange} width="480px">
        <DialogContent>
          <div className="p-6">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
              You are already signed in.
            </h2>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} width="480px">
      <DialogContent>
        <div className="p-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
                Sign in to {APP_NAME}
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Sign in with GitHub, Passkey, Magic Link, or enter your API key
                to continue.
              </p>
            </div>

            <Button
              type="button"
              variant="primary"
              onClick={handleGithubLogin}
              className="w-full bg-zinc-800 text-white hover:bg-zinc-700"
              disabled={awaitingGithubLogin}
              icon={<Github size={18} />}
              isLoading={awaitingGithubLogin}
            >
              Sign in with GitHub
            </Button>

            {passkeysSupported && (
              <Button
                type="button"
                variant="primary"
                onClick={handlePasskeyLogin}
                className="w-full border border-zinc-300 dark:border-zinc-700 bg-white text-zinc-900 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700"
                disabled={isAuthenticatingWithPasskey}
                icon={<KeySquare size={18} />}
                isLoading={isAuthenticatingWithPasskey}
              >
                Sign in with Passkey
              </Button>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-300 dark:border-zinc-700" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-off-white dark:bg-zinc-900 px-2 text-zinc-500">
                  Or continue with
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <TextInput
                id="email"
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                  setEmailSubmitted(false);
                }}
                placeholder="Enter your email address"
                className={error && email.length > 0 ? "border-red-500" : ""}
                description={error || undefined}
                disabled={isRequestingLink}
              />
              {emailSubmitted ? (
                <p className="text-sm text-green-600 dark:text-green-400">
                  Check your email for a magic link to sign in!
                </p>
              ) : (
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleMagicLinkRequest}
                  className="w-full"
                  isLoading={isRequestingLink}
                  icon={<Mail size={18} />}
                  disabled={!email}
                >
                  Sign in with Email
                </Button>
              )}
            </div>

            <div className="mt-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
              By continuing, you agree to our{" "}
              <a href="/terms" className="text-blue-600">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="/privacy" className="text-blue-600">
                Privacy Policy
              </a>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
