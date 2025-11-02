import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { PageShell } from "~/components/Core/PageShell";
import { PageStatus } from "~/components/Core/PageStatus";
import { authService } from "~/lib/api/auth-service";

export function meta() {
	return [
		{ title: "Verifying Login - Polychat" },
		{ name: "description", content: "Verifying your magic link login." },
	];
}

const VerifyMagicLink = () => {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const [error, setError] = useState<string | null>(null);

	const token = searchParams.get("token");
	const nonce = searchParams.get("nonce");

	const { mutate: verify, isPending } = useMutation({
		mutationFn: (params: { token: string; nonce: string }) =>
			authService.verifyMagicLink(params.token, params.nonce),
		onSuccess: async (data) => {
			if (data.success) {
				navigate("/");
			} else {
				setError(
					data.error ||
						"Failed to verify magic link. Please request a new one.",
				);
			}
		},
		onError: (err: Error) => {
			setError(
				err.message || "An unexpected error occurred during verification.",
			);
			console.error("Magic link verification error:", err);
		},
	});

	useEffect(() => {
		if (token && nonce) {
			verify({ token, nonce });
		} else if (
			!isPending &&
			(typeof token === "undefined" || typeof nonce === "undefined")
		) {
			setError("Invalid verification link. Missing required parameters.");
		}
	}, []);

	return (
		<PageShell title="Magic Link Verification" displayNavBar={false}>
			{error ? (
				<PageStatus title="Verification Failed" message={error} />
			) : isPending || !token || !nonce ? (
				<PageStatus
					icon={<Loader2 size={32} className="animate-spin text-blue-600" />}
					message="Verifying your login link..."
				/>
			) : (
				<PageStatus message="Verification complete. Redirecting..." />
			)}
		</PageShell>
	);
};

export default function VerifyMagicLinkRoute() {
	return <VerifyMagicLink />;
}
