'use client';

import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from "@/firebase/client-provider";
import { Providers as QueryProviders } from "@/lib/providers";
import { type ReactNode } from "react";

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProviders>
      <FirebaseClientProvider>
        {children}
      </FirebaseClientProvider>
      <Toaster />
    </QueryProviders>
  );
}
