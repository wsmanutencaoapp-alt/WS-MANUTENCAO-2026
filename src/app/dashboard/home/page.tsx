'use client';

import CorporateMural from '@/components/CorporateMural';
import { useUser } from '@/firebase';

export default function DashboardHomePage() {
  const { user } = useUser();

  const getFirstName = () => {
    if (!user?.displayName) return '';
    return user.displayName.split(' ')[0];
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Bem-vindo(a) de volta, {getFirstName()}!</h1>
      <p className="text-muted-foreground">
        Aqui estão as últimas atualizações e comunicados da empresa.
      </p>
      
      <CorporateMural />

    </div>
  );
}
