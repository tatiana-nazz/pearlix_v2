import { QueryClientProvider } from "@tanstack/react-query";
import { type PropsWithChildren, useSyncExternalStore } from "react";

import {
  getQueryClientSession,
  subscribeToQueryClientSession,
} from "./queryClient";

export function AppProviders({ children }: PropsWithChildren) {
  const session = useSyncExternalStore(
    subscribeToQueryClientSession,
    getQueryClientSession,
    getQueryClientSession,
  );

  return (
    <QueryClientProvider client={session.client} key={session.generation}>
      {children}
    </QueryClientProvider>
  );
}
