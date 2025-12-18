'use client';

import { useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Wrench } from 'lucide-react';
import type { Tool } from '@/lib/types';
import { ToolingAlertHeader } from '@/components/ToolingAlertHeader';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import MovementTables from '@/components/MovementTables';
import { Skeleton } from '@/components/ui/skeleton';

// This is now the main container component for the movement page.
// It is responsible for fetching all necessary data and passing it down to child components.
// This pattern avoids re-fetching and infinite loops caused by nested components triggering state changes.
const MovimentacaoFerramentariaPage = () => {
  const { toast } = useToast();
  const firestore = useFirestore();

  // Query 1: Fetch all tools that are currently available for loan.
  const availableToolsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'tools'), where('status', '==', 'Disponível')) : null),
    [firestore]
  );
  
  const { data: availableTools, isLoading: isLoadingAvailable, error: availableError } = useCollection<WithDocId<Tool>>(availableToolsQuery, {
      queryKey: ['availableToolsForMovement']
  });

  // Query 2: Fetch all tools that are currently on loan.
  const loanedToolsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'tools'), where('status', '==', 'Em Empréstimo')) : null),
    [firestore]
  );
  
  const { data: loanedTools, isLoading: isLoadingLoaned, error: loanedError } = useCollection<WithDocId<Tool>>(loanedToolsQuery, {
      queryKey: ['loanedToolsForMovement']
  });
  
  // Memoize the filtered tools to prevent re-calculations on every render.
  const toolsForKit = useMemo(() => {
    return availableTools?.filter(tool => tool.enderecamento !== 'LOGICA') || [];
  }, [availableTools]);

  // Combine loading states
  const isLoading = isLoadingAvailable || isLoadingLoaned;

  // Display a single loading skeleton if data isn't ready.
  if (isLoading) {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold flex items-center">
                <Wrench className="h-6 w-6 mr-2" /> Controle de Entrada e Saída de Ferramentas
            </h1>
            <div className="flex justify-end gap-2">
                <Skeleton className="h-10 w-40" />
                <Skeleton className="h-10 w-40" />
                <Skeleton className="h-10 w-44" />
            </div>
            <Skeleton className="h-96 w-full" />
        </div>
    );
  }

  // Display error message if fetching fails
  if (availableError || loanedError) {
      const error = availableError || loanedError;
      toast({ variant: 'destructive', title: 'Erro ao buscar equipamentos', description: error?.message || 'Você pode não ter permissão para ver estes dados.'})
  }

  return (
    <div className="space-y-6">
      <ToolingAlertHeader />
      <h1 className="text-2xl font-bold flex items-center">
        <Wrench className="h-6 w-6 mr-2" /> Controle de Entrada e Saída de Ferramentas
      </h1>
      
      {/* The MovementTables component now receives all data as props */}
      <MovementTables 
        availableTools={toolsForKit} 
        loanedTools={loanedTools || []}
      />
    </div>
  );
};

export default MovimentacaoFerramentariaPage;
