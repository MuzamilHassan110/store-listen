import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "./contexts/LanguageContext";
import { StoreProvider } from "./contexts/StoreContext";
import { ToastProvider } from "./contexts/ToastContext";
import { AuthProvider } from "./lib/auth";
import { registerSW } from "virtual:pwa-register";
import { ErrorBoundary } from "./components/ErrorBoundary";
import App from "./App";
import "./index.css";

registerSW({ immediate: true });

const root = document.getElementById("root");
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 60_000,
    },
  },
});

if (!root) {
  throw new Error("Root element not found");
}

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <StoreProvider>
            <ToastProvider>
              <ErrorBoundary>
                <BrowserRouter>
                  <App />
                </BrowserRouter>
              </ErrorBoundary>
            </ToastProvider>
          </StoreProvider>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  </StrictMode>,
);
