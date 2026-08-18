import { PageStatus } from "@ngriffin_uk/polychat-component-ui";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { PageShell } from "~/components/Core/PageShell";
import { authService } from "~/lib/api/auth-service";

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

  const { mutate: verify, isPending } = useMutation({
    mutationFn: (token: string) => authService.verifyMagicLink(token),
    onSuccess: async (data) => {
      if (data.success) {
        void navigate("/");
      } else {
        setError(data.error || "Failed to verify magic link. Please request a new one.");
      }
    },
    onError: (err: Error) => {
      setError(err.message || "An unexpected error occurred during verification.");
      console.error("Magic link verification error:", err);
    },
  });

  useEffect(() => {
    if (token) {
      verify(token);
    } else {
      setError("Invalid verification link. Missing required token.");
    }
  }, []);

  return (
    <PageShell title="Magic Link Verification" displayNavBar={false}>
      {error ? (
        <PageStatus title="Verification Failed" message={error} />
      ) : isPending || !token ? (
        <PageStatus
          icon={<Loader2 size={32} className="animate-spin text-blue-600" />}
          message="Verifying your login link..."
        />
      ) : (
        <PageStatus message="Verification complete. Redirecting..." />
      )}
    </PageShell>
  );
};

export default function VerifyMagicLinkRoute() {
  return <VerifyMagicLink />;
}
