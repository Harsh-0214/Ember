"use client";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { SerwistProvider } from "@serwist/turbopack/react";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { Toaster } from "sonner";

const CACHE_BUSTER = "ember-v1";

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 1000 * 60 * 60 * 24 * 7,
        retry: (count, err) => count < 2 && !(err instanceof Error && /JWT|401|403/.test(err.message)),
        refetchOnWindowFocus: true,
        networkMode: "offlineFirst",
      },
      mutations: { networkMode: "offlineFirst" },
    },
  });
}

const noopStorage = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(makeClient);
  const [persister] = useState(() =>
    createSyncStoragePersister({
      storage: typeof window === "undefined" ? noopStorage : window.localStorage,
      key: "ember-query-cache",
      throttleTime: 1500,
    }),
  );
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <PersistQueryClientProvider
        client={client}
        persistOptions={{
          persister,
          buster: CACHE_BUSTER,
          maxAge: 1000 * 60 * 60 * 24 * 7,
          dehydrateOptions: { shouldDehydrateQuery: (q) => q.state.status === "success" && q.queryKey[0] !== "search" },
        }}
        // Persisted data paints instantly; then everything is revalidated, since the
        // snapshot may predate the last writes (writes are throttled, iOS can kill the app).
        onSuccess={() => void client.invalidateQueries()}
      >
        <SerwistProvider swUrl="/serwist/sw.js" disable={process.env.NODE_ENV !== "production"} reloadOnOnline={false}>
          {children}
        </SerwistProvider>
        <Toaster
          position="bottom-center"
          richColors
          closeButton={false}
          toastOptions={{ className: "!rounded-2xl" }}
          offset={{ bottom: "calc(env(safe-area-inset-bottom) + 76px)" }}
          mobileOffset={{ bottom: "calc(env(safe-area-inset-bottom) + 76px)" }}
        />
      </PersistQueryClientProvider>
    </ThemeProvider>
  );
}
