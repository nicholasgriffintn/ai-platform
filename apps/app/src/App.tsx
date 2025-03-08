import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { ChatApp } from "./routes/ChatApp";
import Terms from "./routes/Terms";
import Privacy from "./routes/Privacy";
import { apiKeyService } from "./lib/api-key";
import { ErrorProvider } from "./contexts/ErrorContext";
import { LoadingProvider } from "./contexts/LoadingContext";
import ErrorToast from "./components/ErrorToast";

export function App() {
	const [hasApiKey, setHasApiKey] = useState(false);

	useEffect(() => {
		const getApiKey = async () => {
			const apiKey = await apiKeyService.getApiKey();
			setHasApiKey(!!apiKey);
		};
		getApiKey();
	}, []);

	const handleKeySubmit = () => {
		setHasApiKey(true);
	};

	return (
		<ErrorProvider>
			<LoadingProvider>
				<BrowserRouter>
					<Routes>
						<Route path="/" element={
							<ChatApp hasApiKey={hasApiKey} onKeySubmit={handleKeySubmit} />
						} />
						<Route path="/terms" element={<Terms />} />
						<Route path="/privacy" element={<Privacy />} />
					</Routes>
					<ErrorToast />
				</BrowserRouter>
			</LoadingProvider>
		</ErrorProvider>
	);
}
