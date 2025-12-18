'use client';

import { useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Tool } from '@/lib/types';
import { differenceInDays, isFuture } from 'date-fns';
import { AlertCircle, Wrench } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';

export function ToolingAlertHeader() {
  const firestore = useFirestore();

  const toolsNeedingAttentionQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    // Firestore does not allow 'in' and 'not-in' on different fields.
    // So we query for tools that have a controllable classification AND are in a state where calibration matters.
    return query(
      collection(firestore, 'tools'),
      where('classificacao', 'in', ['C', 'L', 'V']),
      where('status', 'in', ['Disponível', 'Em Empréstimo', 'Em Aferição'])
    );
  }, [firestore]);

  const { data: tools, isLoading } = useCollection<Tool>(toolsNeedingAttentionQuery, {
      queryKey: ['toolsForCalibrationAlert']
  });

  const toolsNearExpiry = useMemo(() => {
    if (!tools) return [];
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return tools.filter(tool => {
      if (!tool.data_vencimento) return false;
      
      const dueDate = new Date(tool.data_vencimento);
      
      // Check if the due date is in the future. We don't want to show already expired tools in this specific alert.
      // The calibration page will handle showing expired ones.
      if (!isFuture(dueDate)) return false; 

      const daysUntilDue = differenceInDays(dueDate, today);
      
      return daysUntilDue >= 0 && daysUntilDue <= 60;
    });
  }, [tools]);

  if (isLoading || !toolsNearExpiry || toolsNearExpiry.length === 0) {
    return null; // Don't render anything if loading, no data, or no tools need attention
  }

  return (
    <Alert variant="default" className="border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300 [&>svg]:text-yellow-600 dark:[&>svg]:text-yellow-400 mb-6">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="font-bold">Atenção Necessária na Ferramentaria</AlertTitle>
      <AlertDescription>
        Você tem <span className="font-bold">{toolsNearExpiry.length}</span> ferramenta(s) com calibração ou validade vencendo nos próximos 60 dias.
        <Link href="/dashboard/calibracao" className="underline font-semibold ml-2 hover:text-yellow-900 dark:hover:text-yellow-100">
          Verificar agora.
        </Link>
      </AlertDescription>
    </Alert>
  );
}
