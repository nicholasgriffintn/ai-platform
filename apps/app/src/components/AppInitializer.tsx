import { useEffect } from "react";

import { authService } from "~/lib/api/auth-service";
import { useChatStore } from "~/state/stores/chatStore";

export const AppInitializer = ({ children }: { children: React.ReactNode }) => {
	const { setIsPro } = useChatStore();

	useEffect(() => {
		const user = authService.getUser();
		if (user) {
			setIsPro(user.plan === "pro");
		}
	}, [setIsPro]);

	return <>{children}</>;
};
