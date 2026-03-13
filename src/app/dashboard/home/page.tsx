'use client';

import CorporateMural from '@/components/CorporateMural';
import BirthdaysCard from '@/components/BirthdaysCard';
import { useUser } from '@/firebase';

export default function DashboardHomePage() {
  const { user } = useUser();

  const getFirstName = () => {
    if (!user?.displayName) return '';
    return user.displayName.split(' ')[0];
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
