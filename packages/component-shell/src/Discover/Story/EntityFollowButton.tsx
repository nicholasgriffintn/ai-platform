import { Button } from "@ngriffin_uk/polychat-component-ui";
import {
  useAuthStatus,
  useDiscover,
  useDiscoverFollows,
} from "@ngriffin_uk/polychat-library-react";
import { Check, Plus } from "lucide-react";

export function EntityFollowButton({ name }: { name: string }) {
  const { isAuthenticated } = useAuthStatus();
  const discover = useDiscover(isAuthenticated);
  const { follow } = useDiscoverFollows();
  const wanted = name.toLowerCase();
  const following =
    follow.isSuccess ||
    (discover.data?.follows ?? []).some((entry) => entry.topic.toLowerCase() === wanted);

  return (
    <div className="pt-1">
      <Button
        variant="outline"
        size="sm"
        icon={following ? <Check size={14} aria-hidden /> : <Plus size={14} aria-hidden />}
        disabled={following || follow.isPending}
        onClick={() => follow.mutate(name)}
      >
        {following ? "Following" : "Follow"}
      </Button>
    </div>
  );
}
