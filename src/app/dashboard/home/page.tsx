'use client';

import CorporateMural from '@/components/CorporateMural';
import BirthdaysCard from '@/components/BirthdaysCard';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import type { Employee } from '@/lib/types';
import { doc } from 'firebase/firestore';


export default function DashboardHomePage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'employees', user.uid) : null),
    [firestore, user]
  );
  const { data: employeeData } = useDoc<Employee>(userDocRef);

  const getFirstName = () => {
    if (employeeData?.firstName) {
        return employeeData.firstName;
    }
    // Fallback just in case, though the primary source should be Firestore.
    if (user?.displayName) {
        return user.displayName.split(' ')[0];
    }
    return '';
  }

  return (
    <div className="space-y-6">
       <div>
        <h1 className="text-3xl font-bold tracking-tight">Bem-vindo(a) de volta, {getFirstName()}!</h1>
        <p className="text-muted-foreground">
          Aqui estão as últimas atualizações, comunicados e aniversariantes do mês.
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
            <CorporateMural />
        </div>
        <div className="lg:col-span-1">
            <BirthdaysCard />
        </div>
      </div>

    </div>
  );
}
