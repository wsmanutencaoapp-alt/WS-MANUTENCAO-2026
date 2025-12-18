'use client';
import type { ReactNode } from 'react';
import { AppSidebar } from '@/components/app-sidebar';
import { Header } from '@/components/header';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { useEffect, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { SidebarProvider } from '@/components/ui/sidebar';
import { doc } from 'firebase/firestore';
import type { Employee } from '@/lib/types';
import { allUserPermissions, getRequiredPermissionForPath } from '@/lib/permissions';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'employees', user.uid) : null),
    [firestore, user]
  );
  const { data: employeeData, isLoading: isEmployeeLoading } = useDoc<Employee>(userDocRef);

  const isLoading = isUserLoading || isEmployeeLoading;

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
      return;
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
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
    <div className="min-h-screen w-full bg-muted/40 dark:bg-background">
      <SidebarProvider>
        <AppSidebar />
        <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14 md:pl-14 transition-[margin-left] ease-in-out duration-300 md:group-[[data-sidebar-state=expanded]]/sidebar-wrapper:ml-64">
            <Header />
            <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
              {children}
            </main>
        </div>
      </SidebarProvider>
    </div>
  );
}
