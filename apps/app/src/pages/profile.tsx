import { Loader2 } from "lucide-react";
import { useState } from "react";

import { LoginModal } from "~/components/LoginModal";
import { ProfileView } from "~/components/Profile/ProfileView";
import { Button } from "~/components/ui/Button";
import { useAuthStatus } from "~/hooks/useAuth";
import { AppLayout } from "~/layouts/AppLayout";

export function meta() {
  return [
    { title: "Profile" },
    { name: "description", content: "User profile" },
  ];
}

export default function ProfilePage() {
  const { isAuthenticated, isLoading } = useAuthStatus();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] gap-4">
            <Loader2 size={32} className="animate-spin text-blue-600" />
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Loading profile data...
            </p>
          </div>
        ) : !isAuthenticated ? (
          <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] gap-4">
            <p className="text-zinc-500 dark:text-zinc-400 mb-4">
              You need to log in to view your profile.
            </p>
            <Button
              type="button"
              variant="primary"
              onClick={() => setIsLoginModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Login
            </Button>
          </div>
        ) : (
          <ProfileView />
        )}
      </div>
      <LoginModal
        open={isLoginModalOpen}
        onOpenChange={setIsLoginModalOpen}
        onKeySubmit={() => setIsLoginModalOpen(false)}
      />
    </AppLayout>
  );
}
