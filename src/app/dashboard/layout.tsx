'use client';
import type { ReactNode } from 'react';
import { AppSidebar } from '@/components/app-sidebar';
import { Header } from '@/components/header';
import { useUser } from '@/firebase';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { SidebarProvider } from '@/components/ui/sidebar';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading || !user) {
    return (
       <div className="flex min-h-screen w-full flex-col">
        <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
             <Skeleton className="h-8 w-8 sm:hidden" />
            <div className="relative ml-auto flex-1 md:grow-0">
               <Skeleton className="h-8 w-full rounded-lg md:w-[200px] lg:w-[336px]" />
            </div>
            <Skeleton className="h-8 w-8 rounded-full" />
          </header>
          <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
            <Skeleton className="h-[50vh] w-full" />
          </main>
        </div>
      </div>
    );
  }


  return (
    <SidebarProvider>
        <div className="flex min-h-screen w-full flex-col bg-muted/40 dark:bg-background">
        <AppSidebar />
        <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14 md:pl-14 transition-[margin-left] ease-in-out duration-300 md:group-[[data-sidebar-state=expanded]]/sidebar-wrapper:ml-64">
            <Header />
            <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
            {children}
            </main>
        </div>
        </div>
    </SidebarProvider>
  );
}
