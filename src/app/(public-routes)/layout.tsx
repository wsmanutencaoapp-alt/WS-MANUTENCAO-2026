import type { ReactNode } from 'react';
import { PublicHeader } from '@/components/public-header';

// A layout for public-facing pages that don't need the dashboard sidebar/header
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full flex flex-col bg-muted/40 dark:bg-background">
        <PublicHeader />
        <main className="flex-1">
          {children}
        </main>
    </div>
  );
}
