import { PageHeader } from "~/components/Core/PageHeader";
import { PageTitle } from "~/components/Core/PageTitle";
import { UserSettingsForm } from "~/components/Profile/UserSettingsForm";
import { useAuthStatus } from "~/hooks/useAuth";

export function ProfileCustomisationTab() {
	const { user, userSettings, isAuthenticated } = useAuthStatus();

	return (
		<div>
			<PageHeader>
				<PageTitle title="Customise Chat" />
			</PageHeader>

			<div className="space-y-6">
				<UserSettingsForm
					userSettings={userSettings ?? null}
					isAuthenticated={isAuthenticated}
					isPro={user?.plan_id === "pro"}
				/>
			</div>
		</div>
	);
}
