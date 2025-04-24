import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { authService } from "~/lib/api/auth-service";
import { PageHeader } from "../../components/PageHeader";
import { PageTitle } from "../../components/PageTitle";

export function meta() {
  return [
    { title: "Verifying Login - Polychat" },
    { name: "description", content: "Verifying your magic link login." },
  ];
}

const VerifyMagicLink = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  const token = searchParams.get("token");
  const nonce = searchParams.get("nonce");

  const { mutate: verify, isPending } = useMutation({
    mutationFn: (params: { token: string; nonce: string }) =>
      authService.verifyMagicLink(params.token, params.nonce),
    onSuccess: async (data) => {
      if (data.success) {
        navigate("/");
      } else {
        setError(
          data.error ||
            "Failed to verify magic link. Please request a new one.",
        );
      }
    },
    onError: (err: Error) => {
      setError(
        err.message || "An unexpected error occurred during verification.",
      );
      console.error("Magic link verification error:", err);
    },
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: Only run on load
  useEffect(() => {
    if (token && nonce) {
      verify({ token, nonce });
    } else if (
      !isPending &&
      (typeof token === "undefined" || typeof nonce === "undefined")
    ) {
      setError("Invalid verification link. Missing required parameters.");
    }
  }, []);

  let content;
  if (error) {
    content = (
      <>
        <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">
          Verification Failed
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center px-4">
          {error}
        </p>
      </>
    );
  } else if (isPending || !token || !nonce) {
    content = (
      <>
        <Loader2 size={32} className="animate-spin text-blue-600" />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Verifying your login link...
        </p>
      </>
    );
  } else {
    content = (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Verification complete. Redirecting...
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] gap-4">
      <PageHeader>
        <PageTitle title="Magic Link Verification" />
      </PageHeader>
      {content}
    </div>
  );
};

export default function VerifyMagicLinkRoute() {
  return <VerifyMagicLink />;
}
