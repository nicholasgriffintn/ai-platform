import { KeyRound, Loader2, User } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";

import { Button } from "~/components/ui";
import { useAuthStatus } from "~/hooks/useAuth";
import { useChatStore } from "~/state/stores/chatStore";

export function UserMenuItem() {
  const { isAuthenticated, setShowLoginModal } = useChatStore();
  const { user, isLoggingOut, isLoading } = useAuthStatus();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="flex items-center justify-center p-2 text-zinc-700 dark:text-zinc-200">
        <User size={16} />
        <span className="sr-only">User</span>
      </div>
    );
  }

  return (
    <>
      {isLoading ? (
        <div className="flex items-center justify-center p-2 text-zinc-700 dark:text-zinc-200">
          <Loader2 size={16} className="animate-spin" />
          <span className="sr-only">Loading...</span>
        </div>
      ) : !isAuthenticated ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() => setShowLoginModal(true)}
          className="cursor-pointer flex items-center justify-center p-2 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md"
          icon={<KeyRound size={16} />}
        >
          Login
        </Button>
      ) : user ? (
        <Link
          to="/profile"
          className="no-underline cursor-pointer flex items-center justify-center p-2 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md"
          aria-disabled={isLoggingOut}
        >
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.name || "User"}
              className="w-6 h-6 rounded-full object-cover"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-semibold">
              {user.name ? user.name.charAt(0).toUpperCase() : "U"}
            </div>
          )}
          <span className="sr-only">Profile</span>
        </Link>
      ) : null}
    </>
  );
}
