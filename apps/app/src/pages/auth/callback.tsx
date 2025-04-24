import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router";

import { useAuthStatus } from "~/hooks/useAuth";
import { PageHeader } from "../../components/PageHeader";
import { PageTitle } from "../../components/PageTitle";

export function meta() {
  return [
    { title: "Authentication Callback - Polychat" },
    { name: "description", content: "Authentication callback for Polychat" },
  ];
}

const AuthCallback = () => {
  const navigate = useNavigate();
  const { isLoading } = useAuthStatus();

  useEffect(() => {
    if (!isLoading) {
      navigate("/");
    }
  }, [isLoading, navigate]);

  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] gap-4">
      <PageHeader>
        <PageTitle title="Completing authentication..." />
        <Loader2 size={32} className="animate-spin text-blue-600" />
      </PageHeader>
    </div>
  );
};

export default function AuthCallbackRoute() {
  return <AuthCallback />;
}
