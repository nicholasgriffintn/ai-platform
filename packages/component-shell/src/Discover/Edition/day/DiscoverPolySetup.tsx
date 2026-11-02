import { Button } from "@ngriffin_uk/polychat-component-ui";
import { openPolyWithPrompt } from "@ngriffin_uk/polychat-library-react";
import { MessageCircle } from "lucide-react";

export function DiscoverPolySetup({
  configured,
  onOpen,
}: {
  configured: boolean;
  onOpen: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-muted-foreground">
        {configured
          ? "Tell Poly what has changed, whether it is just tomorrow or your usual routine."
          : "Tell Poly about your week and what interests you. It will help you choose useful updates, one question at a time."}
      </p>
      <Button
        onClick={() => {
          onOpen();
          openPolyWithPrompt(
            configured
              ? "I'd like to update my Discover routine."
              : "Help me set up Discover around my week, interests and catch-up times.",
          );
        }}
      >
        <MessageCircle size={16} aria-hidden />
        {configured ? "Update with Poly" : "Set up Discover with Poly"}
      </Button>
    </div>
  );
}
