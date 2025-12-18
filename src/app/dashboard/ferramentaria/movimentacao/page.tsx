'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import ToolMovementTable from '@/components/ToolMovementTable';
import { Button } from '@/components/ui/button';
import { ListChecks, Send, Wrench, Loader2, History, LogOut, LogIn } from 'lucide-react';
import ToolLoanRequestDialog from '@/components/ToolLoanRequestDialog';
import ToolRequestTable, { ToolRequestTableRef } from '@/components/ToolRequestTable';
import ToolMovementHistoryTable, { ToolMovementHistoryTableRef } from '@/components/ToolMovementHistoryTable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Tool } from '@/lib/types';
import { ToolingAlertHeader } from '@/components/ToolingAlertHeader';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import ManualCheckoutDialog from '@/components/ManualCheckoutDialog';
import ManualCheckInDialog from '@/components/ManualCheckInDialog';

const MovimentacaoFerramentaria = () => {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [isCheckoutDialogOpen, setIsCheckoutDialogOpen] = useState(false);
  const [isCheckInDialogOpen, setIsCheckInDialogOpen] = useState(false);
  
  const requestTableRef = useRef<ToolRequestTableRef>(null);
  const historyTableRef = useRef<ToolMovementHistoryTableRef>(null);

  // Consulta para ferramentas disponíveis
  const availableToolsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'tools'), where('status', '==', 'Disponível')) : null),
    [firestore]
  );
  
  const { data: availableTools, isLoading: isLoadingAvailable, error: availableError } = useCollection<WithDocId<Tool>>(availableToolsQuery, {
      queryKey: ['availableTools']
  });

  // Consulta para ferramentas emprestadas
  const loanedToolsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'tools'), where('status', '==', 'Em Empréstimo')) : null),
    [firestore]
  );
  
  const { data: loanedTools, isLoading: isLoadingLoaned, error: loanedError } = useCollection<WithDocId<Tool>>(loanedToolsQuery, {
      queryKey: ['loanedTools']
  });


  const handleActionSuccess = () => {
    requestTableRef.current?.refetchRequests();
    historyTableRef.current?.refetchHistory();
    // Invalidação das queries de ferramentas será feita pelos hooks useCollection
    toast({ title: "Sucesso!", description: "A operação foi concluída." });
    setIsRequestDialogOpen(false);
    setIsCheckoutDialogOpen(false);
    setIsCheckInDialogOpen(false);
  };
  
  useEffect(() => {
    if(availableError || loanedError){
        toast({ variant: 'destructive', title: 'Erro ao buscar equipamentos', description: 'Você pode não ter permissão para ver estes dados.'})
    }
  }, [availableError, loanedError, toast]);

  const isLoading = isLoadingAvailable || isLoadingLoaned;

  return (
    <div className="space-y-6">
      <ToolingAlertHeader />
      <h1 className="text-2xl font-bold flex items-center">
        <Wrench className="h-6 w-6 mr-2" /> Controle de Entrada e Saída de Ferramentas
      </h1>
      
      <div className="flex justify-end gap-2">
         <Button variant="outline" onClick={() => setIsCheckInDialogOpen(true)}>
            <LogIn className="mr-2 h-4 w-4" /> Registrar Entrada
        </Button>
        <Button variant="outline" onClick={() => setIsCheckoutDialogOpen(true)}>
            <LogOut className="mr-2 h-4 w-4" /> Registrar Saída
        </Button>
        <Button onClick={() => setIsRequestDialogOpen(true)}>
          <Send className="mr-2 h-4 w-4" /> Solicitar Empréstimo
        </Button>
      </div>
      
      <Tabs defaultValue="requisicoes">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="requisicoes">
            <ListChecks className="mr-2 h-4 w-4" /> Requisições Ativas
          </TabsTrigger>
          <TabsTrigger value="historico">
            <History className="mr-2 h-4 w-4" /> Histórico de Movimentações
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="requisicoes" className="mt-4">
          <ToolRequestTable 
            ref={requestTableRef}
            onActionSuccess={handleActionSuccess}
          />
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
           <ToolMovementHistoryTable
            ref={historyTableRef}
          />
        </TabsContent>
      </Tabs>
      
      <ToolLoanRequestDialog 
        isOpen={isRequestDialogOpen}
        onClose={() => setIsRequestDialogOpen(false)}
        allAvailableTools={availableTools || []}
        onActionSuccess={handleActionSuccess}
      />

      <ManualCheckoutDialog
        isOpen={isCheckoutDialogOpen}
        onClose={() => setIsCheckoutDialogOpen(false)}
        allAvailableTools={availableTools || []}
        onActionSuccess={handleActionSuccess}
      />

      <ManualCheckInDialog
        isOpen={isCheckInDialogOpen}
        onClose={() => setIsCheckInDialogOpen(false)}
        allLoanedTools={loanedTools || []}
        onActionSuccess={handleActionSuccess}
      />
    </div>
  );
};

export default MovimentacaoFerramentaria;
