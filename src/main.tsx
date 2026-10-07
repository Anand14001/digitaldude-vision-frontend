import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import axios from 'axios';
import App from './App';
import { watchSystemTheme } from './lib/theme';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Never retry a refusal; the answer will not change.
        if (axios.isAxiosError(error)) {
          const status = error.response?.status ?? 0;
          if (status === 401 || status === 403 || status === 404 || status === 409) return false;
        }
        return failureCount < 2;
      },
    },
    mutations: { retry: false },
  },
});

watchSystemTheme();

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster
          position="bottom-right"
          closeButton
          toastOptions={{
            classNames: {
              toast:
                'bg-surface border border-border text-fg shadow-pop rounded-xl text-sm',
              description: 'text-muted',
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
