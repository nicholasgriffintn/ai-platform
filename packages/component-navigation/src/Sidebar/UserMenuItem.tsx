import { Button, Link } from "@ngriffin_uk/polychat-component-ui";
import { KeyRound, Loader2, User } from "lucide-react";

export interface UserMenuAccount {
  name?: string | null;
  avatarUrl?: string | null;
}

export interface UserMenuItemProps {
  account: UserMenuAccount | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isLoggingOut: boolean;
  isReady: boolean;
  profileHref: string;
  onSignIn: () => void;
}

export function UserMenuItem({
  account,
  isAuthenticated,
  isLoading,
  isLoggingOut,
  isReady,
  profileHref,
  onSignIn,
}: UserMenuItemProps) {
  if (!isReady) {
    return (
      <div className="flex items-center justify-center w-10 h-10 text-foreground">
        <User size={16} />
        <span className="sr-only">User</span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-10 h-10 text-foreground">
        <Loader2 size={16} className="animate-spin" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Button
        type="button"
        variant="ghost"
        onClick={onSignIn}
        className="cursor-pointer flex items-center justify-center p-2 text-foreground hover:bg-surface-elevated rounded-md"
        icon={<KeyRound size={16} />}
      >
        Login
      </Button>
    );
  }

  if (!account) {
    return null;
  }

  return (
    <Link
      href={profileHref}
      className="no-underline cursor-pointer flex items-center justify-center w-10 h-10 text-foreground hover:bg-surface-elevated rounded-md"
      aria-disabled={isLoggingOut}
    >
      {account.avatarUrl ? (
        <img
          src={account.avatarUrl}
          alt={account.name || "User"}
          className="w-6 h-6 rounded-full object-cover"
          loading="eager"
        />
      ) : (
        <div className="w-6 h-6 rounded-full bg-creative flex items-center justify-center text-background text-xs font-semibold">
          {account.name ? account.name.charAt(0).toUpperCase() : "U"}
        </div>
      )}
      <span className="sr-only">Profile</span>
    </Link>
  );
}
