import { Link } from "@ngriffin_uk/polychat-component-ui";
import { Loader2 } from "lucide-react";

export interface ConversationFooterInfoProps {
  isPanelVisible: boolean;
  isAuthLoading?: boolean;
  hasConversationContext: boolean;
  isMobile?: boolean;
}

export const ConversationFooterInfo = ({
  isPanelVisible,
  isAuthLoading = false,
  hasConversationContext,
  isMobile = false,
}: ConversationFooterInfoProps) => {
  return (
    <div
      className={`shrink-0 px-4 py-2 text-center text-sm text-zinc-600 dark:text-zinc-400 ${
        isPanelVisible ? "pr-[90%] sm:pr-[350px] md:pr-[400px] lg:pr-[650px]" : ""
      }`}
    >
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
              {!isMobile &&
                !isPanelVisible &&
                " Check relevant sources before making important decisions."}
            </>
          ) : (
            <>
              By using Polychat, you agree to our{" "}
              <Link
                href="/terms"
                className="hover:text-zinc-800 dark:hover:text-zinc-200 underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-sm"
              >
                Terms
              </Link>{" "}
              &{" "}
              <Link
                href="/privacy"
                className="hover:text-zinc-800 dark:hover:text-zinc-200 underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-sm"
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
