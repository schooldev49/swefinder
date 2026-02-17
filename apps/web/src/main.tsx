import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { App } from "./App";
import { initPostHog } from "@/lib/analytics";
import "./index.css";

const queryClient = new QueryClient();
initPostHog();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster theme="dark" richColors position="top-right" />
    </QueryClientProvider>
  </StrictMode>
);
