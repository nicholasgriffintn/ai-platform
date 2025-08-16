import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router';

// Mock providers for testing
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 0,
    },
    mutations: {
      retry: false,
    },
  },
});

interface AllTheProvidersProps {
  children: ReactNode;
  initialEntries?: string[];
  queryClient?: QueryClient;
}

function AllTheProviders({ 
  children, 
  initialEntries = ['/'],
  queryClient = createTestQueryClient(),
}: AllTheProvidersProps) {
  return (
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </MemoryRouter>
  );
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialEntries?: string[];
  queryClient?: QueryClient;
}

const customRender = (
  ui: ReactElement,
  options: CustomRenderOptions = {}
) => {
  const { initialEntries, queryClient, ...renderOptions } = options;
  
  return render(ui, {
    wrapper: ({ children }) => (
      <AllTheProviders 
        initialEntries={initialEntries}
        queryClient={queryClient}
      >
        {children}
      </AllTheProviders>
    ),
    ...renderOptions,
  });
};

// Mock implementations for common hooks
export const mockChatStore = {
  currentConversationId: undefined,
  setCurrentConversationId: vi.fn(),
  model: 'gpt-4',
  setModel: vi.fn(),
  chatInput: '',
  setChatInput: vi.fn(),
  isAuthenticated: false,
  setIsAuthenticated: vi.fn(),
  isPro: false,
  setIsPro: vi.fn(),
};

export const mockUIStore = {
  isMobile: false,
  setIsMobile: vi.fn(),
  sidebarVisible: true,
  setSidebarVisible: vi.fn(),
  showLoginModal: false,
  setShowLoginModal: vi.fn(),
};

// Helper function to create mock conversation data
export const createMockConversation = (overrides = {}) => ({
  id: 'test-conversation-id',
  title: 'Test Conversation',
  messages: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

// Helper function to create mock message data
export const createMockMessage = (overrides = {}) => ({
  id: 'test-message-id',
  role: 'user' as const,
  content: 'Test message content',
  created_at: new Date().toISOString(),
  ...overrides,
});

// Re-export everything from React Testing Library
export * from '@testing-library/react';
export { customRender as render };
export { createTestQueryClient };