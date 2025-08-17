import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router";

import { PageShell } from "~/components/Core/PageShell";
import { PageStatus } from "~/components/Core/PageStatus";
import { useAuthStatus } from "~/hooks/useAuth";

export function meta() {
  return [
    { title: "Authentication Callback - Polychat" },
    { name: "description", content: "Authentication callback for Polychat" },
  ];
}

export default function AuthCallbackRoute() {
  const navigate = useNavigate();
  const { isLoading } = useAuthStatus();

  useEffect(() => {
    if (!isLoading) {
      navigate("/");
    }
  }, [isLoading, navigate]);

  return (
    <PageShell title="Completing authentication..." displayNavBar={false}>
      <PageStatus
        icon={<Loader2 size={32} className="animate-spin text-blue-600" />}
      />
    </PageShell>
  );
}
