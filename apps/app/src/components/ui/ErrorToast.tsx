import { AlertCircle, Info, XCircle } from "lucide-react";
import { memo, useCallback, useMemo } from "react";

import { Button } from "~/components/ui";
import { type ErrorMessage, useError } from "~/state/contexts/ErrorContext";

const getIconByType = (severity: ErrorMessage["severity"]) => {
	switch (severity) {
		case "error":
			return <XCircle className="h-5 w-5 text-red-500" />;
		case "warning":
			return <AlertCircle className="h-5 w-5 text-yellow-500" />;
		case "info":
			return <Info className="h-5 w-5 text-blue-500" />;
	}
};

const getBackgroundColorByType = (severity: ErrorMessage["severity"]) => {
	switch (severity) {
		case "error":
			return "bg-red-50 dark:bg-red-950";
		case "warning":
			return "bg-yellow-50 dark:bg-yellow-950";
		case "info":
			return "bg-blue-50 dark:bg-blue-950";
	}
};

const getTextColorByType = (severity: ErrorMessage["severity"]) => {
	switch (severity) {
		case "error":
			return "text-white dark:text-white";
		case "warning":
			return "text-white dark:text-white";
		case "info":
			return "text-white dark:text-white";
	}
};

const ErrorToast = memo(() => {
	const { errors, removeError } = useError();

	const handleRemoveError = useCallback(
		(id: string) => {
			removeError(id);
		},
		[removeError],
	);

	const errorElements = useMemo(() => {
		return errors.map((error, index) => (
			<div
				key={`${error.id}-${index}`}
				className={`flex items-center gap-2 rounded-lg p-4 shadow-lg ${getBackgroundColorByType(error.severity)} ${getTextColorByType(error.severity)}`}
				role="alert"
			>
				{getIconByType(error.severity)}
				<span className="text-sm font-medium">{error.message}</span>
				<Button
					type="button"
					variant="ghost"
					onClick={() => handleRemoveError(error.id)}
					className="cursor-pointer ml-2 rounded-full p-1 hover:bg-black/5 dark:hover:bg-off-white/5"
					aria-label="Dismiss"
				>
					<XCircle className="h-4 w-4" />
				</Button>
			</div>
		));
	}, [errors, handleRemoveError]);

	if (errors.length === 0) return null;

	return (
		<div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
			{errorElements}
		</div>
	);
});

export default ErrorToast;
