
import type { ReactNode } from 'react';

// A minimal layout for public-facing pages that don't need the dashboard sidebar/header
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-muted/40 dark:bg-background">
        <main className="flex-1">
          {children}
        </main>
    </div>
  );
}

  