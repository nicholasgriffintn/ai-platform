import { Link } from "@ngriffin_uk/polychat-component-ui";
import { Loader2 } from "lucide-react";

export interface ConversationFooterInfoProps {
  isAuthLoading?: boolean;
  hasConversationContext: boolean;
  isMobile?: boolean;
}

export const ConversationFooterInfo = ({
  isAuthLoading = false,
  hasConversationContext,
  isMobile = false,
}: ConversationFooterInfoProps) => {
  return (
    <div className="shrink-0 px-4 py-2 text-center text-sm text-muted-foreground">
      {isAuthLoading ? (
        <p className="mb-1 flex items-center justify-center gap-2">
          <Loader2 size={12} className="animate-spin" />
          <span>Loading...</span>
        </p>
      ) : (
        <p className="mb-1">
          {hasConversationContext ? (
            <>
              AI can make mistakes.
              {!isMobile && " Check relevant sources before making important decisions."}
            </>
          ) : (
            <>
              By using Polychat, you agree to our{" "}
              <Link
                href="/terms"
                className="rounded-sm underline hover:text-foreground focus:ring-2 focus:ring-active-work focus:ring-offset-2 focus:outline-none"
              >
                Terms
              </Link>{" "}
              &{" "}
              <Link
                href="/privacy"
                className="rounded-sm underline hover:text-foreground focus:ring-2 focus:ring-active-work focus:ring-offset-2 focus:outline-none"
              >
                Privacy
              </Link>
              .
            </>
          )}
        </p>
      )}
    </div>
  );
};
