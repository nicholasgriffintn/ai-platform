import { Banner } from "~/components/ui/Banner";
import { useAuthStatus } from "~/hooks/useAuth";
import { formatDate } from "~/lib/dates";

export function ProfileAccountTab() {
  const { user } = useAuthStatus();

  return (
    <div>
      <h2 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100 mb-6">
        Account
      </h2>

      <div>
        <div>
          <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-100 mb-4">
            Account Information
          </h3>
          <div className="space-y-3">
            {user?.created_at && (
              <div className="flex justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">
                  Member since
                </span>
                <span className="text-zinc-800 dark:text-zinc-200">
                  {formatDate(user?.created_at)}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Plan</span>
              <span className="text-zinc-800 dark:text-zinc-200">
                {user?.plan_id === "pro" ? "Pro" : "Free"}
              </span>
            </div>
            {user?.company && (
              <div className="flex justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">
                  Company
                </span>
                <span className="text-zinc-800 dark:text-zinc-200">
                  {user.company}
                </span>
              </div>
            )}
            {user?.location && (
              <div className="flex justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">
                  Location
                </span>
                <span className="text-zinc-800 dark:text-zinc-200">
                  {user.location}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {user?.bio && (
        <div className="pt-4">
          <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-100 mb-4">
            Bio
          </h3>
          <p className="text-zinc-700 dark:text-zinc-300 whitespace-pre-line">
            {user.bio}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {user?.site && (
          <div>
            <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-100 mb-2">
              Website
            </h3>
            <a
              href={
                user.site.startsWith("http")
                  ? user.site
                  : `https://${user.site}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-700 dark:text-zinc-300"
            >
              {user.site}
            </a>
          </div>
        )}

        {user?.twitter_username && (
          <div>
            <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-100 mb-2">
              Twitter
            </h3>
            <a
              href={`https://twitter.com/${user.twitter_username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-700 dark:text-zinc-300"
            >
              @{user.twitter_username}
            </a>
          </div>
        )}
      </div>

      <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4 mt-6" />

      <h2 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100 mb-6">
        Usage
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="text-zinc-500 dark:text-zinc-400">
          <Banner>TODO: Coming soon</Banner>
        </div>
      </div>
    </div>
  );
}
