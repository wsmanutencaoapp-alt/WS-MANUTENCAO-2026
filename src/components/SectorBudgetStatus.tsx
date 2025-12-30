'use client';

import { useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, limit } from 'firebase/firestore';
import type { Budget } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { DollarSign } from 'lucide-react';

interface SectorBudgetStatusProps {
  sector: string;
}

export default function SectorBudgetStatus({ sector }: SectorBudgetStatusProps) {
  const firestore = useFirestore();
  const currentPeriod = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  const budgetQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'budgets'),
      where('sector', '==', sector),
      where('period', '==', currentPeriod),
      limit(1)
    );
  }, [firestore, sector, currentPeriod]);

  const { data, isLoading, error } = useCollection<Budget>(budgetQuery, {
      queryKey: ['budgetForSector', sector, currentPeriod]
  });
  
  const budget = useMemo(() => (data && data.length > 0 ? data[0] : null), [data]);

  if (isLoading) {
    return <Skeleton className="h-36 w-full" />;
  }

  if (error || !budget) {
    // Don't render anything if there's an error or no budget is found.
    return null;
  }
  
  const spent = budget.spentAmount || 0;
  const total = budget.totalAmount || 1; // Avoid division by zero
  const balance = total - spent;
  const percentageSpent = (spent / total) * 100;


  return (
    <Card className="mb-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium text-blue-900 dark:text-blue-100">
          Budget do Setor ({budget.period})
        </CardTitle>
        <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">
          {balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </div>
        <p className="text-xs text-blue-700 dark:text-blue-300">
          Saldo Disponível de {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </p>
        <Progress value={percentageSpent} className="mt-4 h-2 [&>div]:bg-blue-600" />
        <p className="text-xs text-right mt-1 text-blue-700 dark:text-blue-300">{percentageSpent.toFixed(1)}% utilizado</p>
      </CardContent>
    </Card>
  );
}
