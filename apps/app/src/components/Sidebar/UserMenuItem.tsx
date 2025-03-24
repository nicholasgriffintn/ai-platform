import { KeyRound, Loader2, LogOut, User } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "~/components/ui";
import { DropdownMenu, DropdownMenuItem } from "~/components/ui/DropdownMenu";
import { useAuthStatus } from "~/hooks/useAuth";
import { useChatStore } from "~/state/stores/chatStore";

type UserMenuItemProps = {
  onEnterApiKey: () => void;
  position?: "top" | "bottom";
};

export function UserMenuItem({
  onEnterApiKey,
  position = "bottom",
}: UserMenuItemProps) {
  const { isAuthenticated } = useChatStore();
  const { user, logout, isLoggingOut, isLoading } = useAuthStatus();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleLogout = () => {
    logout();
    onEnterApiKey();
  };

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
          onClick={onEnterApiKey}
          className="cursor-pointer flex items-center justify-center p-2 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md"
          icon={<KeyRound size={16} />}
        >
          Login
        </Button>
      ) : user ? (
        <DropdownMenu
          position={position}
          menuClassName="w-48 rounded-md shadow-lg bg-off-white dark:bg-zinc-800 ring-1 ring-black ring-opacity-5"
          trigger={
            <div
              className="cursor-pointer flex items-center justify-center p-2 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md"
              aria-disabled={isLoggingOut}
            >
              <User size={16} />
              <span className="sr-only">User menu</span>
            </div>
          }
        >
          <div className="px-4 py-2 text-sm text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700 truncate">
            {user.github_username}
          </div>
          <DropdownMenuItem
            onClick={handleLogout}
            icon={<LogOut size={16} />}
            disabled={isLoggingOut}
          >
            Logout
          </DropdownMenuItem>
        </DropdownMenu>
      ) : null}
    </>
  );
}
