'use client';

import { useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Tool } from '@/lib/types';
import { differenceInDays } from 'date-fns';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';

export function ToolingAlertHeader() {
  const firestore = useFirestore();

  const toolsNeedingAttentionQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'tools'),
      where('classificacao', 'in', ['C', 'L', 'V']),
      where('status', 'in', ['Disponível', 'Em Empréstimo', 'Em Aferição', 'Vencido'])
    );
  }, [firestore]);

  const { data: tools, isLoading } = useCollection<Tool>(toolsNeedingAttentionQuery, {
      queryKey: ['toolsForCalibrationAlert']
  });

  const toolsNearOrOverdue = useMemo(() => {
    if (!tools) return [];
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return tools.filter(tool => {
      // Se uma ferramenta controlável não tem data de vencimento, ela precisa de atenção.
      if (!tool.data_vencimento) return true; 
      
      const dueDate = new Date(tool.data_vencimento);
      const daysUntilDue = differenceInDays(dueDate, today);
      
      // Inclui ferramentas já vencidas (daysUntilDue < 0) e as que vencem em 60 dias.
      return daysUntilDue <= 60;
    });
  }, [tools]);

  if (isLoading || !toolsNearOrdue || toolsNearOrdue.length === 0) {
    return null; // Don't render anything if loading, no data, or no tools need attention
  }

  return (
    <Alert variant="default" className="border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300 [&>svg]:text-yellow-600 dark:[&>svg]:text-yellow-400 mb-6">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="font-bold">Atenção Necessária na Ferramentaria</AlertTitle>
      <AlertDescription>
        Você tem <span className="font-bold">{toolsNearOrdue.length}</span> ferramenta(s) com calibração/validade vencida ou vencendo nos próximos 60 dias.
        <Link href="/dashboard/calibracao" className="underline font-semibold ml-2 hover:text-yellow-900 dark:hover:text-yellow-100">
          Verificar agora.
        </Link>
      </AlertDescription>
    </Alert>
  );
}
