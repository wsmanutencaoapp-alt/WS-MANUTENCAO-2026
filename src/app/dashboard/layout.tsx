'use client';
import type { ReactNode } from 'react';
import { AppSidebar } from '@/components/app-sidebar';
import { Header } from '@/components/header';
import { useUser, useDoc, useFirestore, useMemoFirebase, useAuth } from '@/firebase';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { SidebarProvider } from '@/components/ui/sidebar';
import { doc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import type { Employee } from '@/lib/types';
import { getRequiredPermissionForPath } from '@/lib/permissions';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';


export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const firestore = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();

  const [isAuthorized, setIsAuthorized] = useState(false);

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'employees', user.uid) : null),
    [firestore, user]
  );
  const { data: employeeData, isLoading: isEmployeeLoading } = useDoc<Employee>(userDocRef);

  const isLoading = isUserLoading || isEmployeeLoading;

  useEffect(() => {
    if (isLoading) {
      return; // Wait until user and employee data are loaded
    }

    if (!user) {
      router.push('/login');
      return;
    }

    if (user && employeeData) {
      if (employeeData.status !== 'Ativo') {
         toast({
          variant: 'destructive',
          title: 'Acesso Negado',
          description: `Sua conta está com o status "${employeeData.status}". Contate um administrador.`
        });
        signOut(auth).then(() => router.push('/login'));
        return;
      }
      
      const requiredPermission = getRequiredPermissionForPath(pathname);
      const isAdmin = employeeData.accessLevel === 'Admin';
      
      if (isAdmin || !requiredPermission || (employeeData.permissions && employeeData.permissions[requiredPermission])) {
        setIsAuthorized(true);
      } else {
        setIsAuthorized(false);
        router.push('/dashboard');
      }
    } else if (user && !employeeData) {
        // This case can happen if the employee doc is not yet created or fails to load
        router.push('/login');
    }

  }, [user, employeeData, isLoading, router, pathname, toast, auth]);


  if (isLoading || !isAuthorized) {
    return (
       <div className="flex h-screen w-full flex-col items-center justify-center bg-muted/40">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Verificando permissões...</p>
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
