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
      <div className="flex h-10 w-10 items-center justify-center text-foreground">
        <User size={16} />
        <span className="sr-only">User</span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-10 w-10 items-center justify-center text-foreground">
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
        className="flex cursor-pointer items-center justify-center rounded-md p-2 text-foreground hover:bg-surface-elevated"
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
      className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-md text-foreground no-underline hover:bg-surface-elevated"
      aria-disabled={isLoggingOut}
    >
      {account.avatarUrl ? (
        <img
          src={account.avatarUrl}
          alt={account.name || "User"}
          className="h-6 w-6 rounded-full object-cover"
          loading="eager"
        />
      ) : (
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-creative text-xs font-semibold text-background">
          {account.name ? account.name.charAt(0).toUpperCase() : "U"}
        </div>
      )}
      <span className="sr-only">Profile</span>
    </Link>
  );
}
