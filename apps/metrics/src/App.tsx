import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { Analytics } from "./components/analytics";

import { MetricsHome } from "./routes/index";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Analytics />
      <MetricsHome />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
