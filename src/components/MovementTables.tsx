'use client';

import { forwardRef, useImperativeHandle, useState, useMemo, useEffect, useRef } from 'react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { ListChecks, Send, History, LogOut, LogIn } from 'lucide-react';
import ToolLoanRequestDialog from '@/components/ToolLoanRequestDialog';
import ToolRequestTable, { ToolRequestTableRef } from '@/components/ToolRequestTable';
import ToolMovementHistoryTable, { ToolMovementHistoryTableRef } from '@/components/ToolMovementHistoryTable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Tool, ToolRequest } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import ManualCheckoutDialog from '@/components/ManualCheckoutDialog';
import ManualCheckInDialog from '@/components/ManualCheckInDialog';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface MovementTablesProps {
  availableTools: WithDocId<Tool>[];
  loanedTools: WithDocId<Tool>[];
}

// This component now encapsulates all the UI related to the movement tabs and dialogs.
// It receives data as props, making it more stable and less prone to re-rendering loops.
const MovementTables = ({ availableTools, loanedTools }: MovementTablesProps) => {
  const { toast } = useToast();
  const firestore = useFirestore();
  const queryClient = useQueryClient();
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [isCheckoutDialogOpen, setIsCheckoutDialogOpen] = useState(false);
  const [isCheckInDialogOpen, setIsCheckInDialogOpen] = useState(false);
  
  const requestTableRef = useRef<ToolRequestTableRef>(null);
  const historyTableRef = useRef<ToolMovementHistoryTableRef>(null);

  // === Data Fetching for Requests ===
  const activeRequestsKey = ['tool_requests_active'];
  const activeRequestsQuery = useMemoFirebase(
    () => (firestore ? query(
        collection(firestore, 'tool_requests'), 
        where('status', 'in', ['Pendente', 'Em Uso']),
    ) : null),
    [firestore]
  );
  const { data: activeRequests, isLoading: isLoadingActive, error: activeError } = useCollection<WithDocId<ToolRequest>>(activeRequestsQuery, {
      queryKey: activeRequestsKey
  });

  const completedRequestsKey = ['tool_requests_history_completed'];
  const completedRequestsQuery = useMemoFirebase(
    () => (firestore ? query(
        collection(firestore, 'tool_requests'), 
        where('status', 'in', ['Devolvida', 'Cancelada']),
    ) : null),
    [firestore]
  );
  const { data: completedRequests, isLoading: isLoadingCompleted, error: completedError } = useCollection<WithDocId<ToolRequest>>(completedRequestsQuery, {
      queryKey: completedRequestsKey
  });
  
  const allToolsForHistoryQuery = useMemoFirebase(
      () => (firestore ? collection(firestore, 'tools') : null), 
      [firestore]
  );
  const { data: allTools, isLoading: isLoadingAllTools } = useCollection<WithDocId<Tool>>(allToolsForHistoryQuery, {
      queryKey: ['allToolsForHistory'],
  });

  // === Handlers ===
  const handleActionSuccess = () => {
    // Invalidate all relevant queries to ensure data is fresh across the app
    queryClient.invalidateQueries({ queryKey: activeRequestsKey });
    queryClient.invalidateQueries({ queryKey: completedRequestsKey });
    queryClient.invalidateQueries({ queryKey: ['availableToolsForMovement'] });
    queryClient.invalidateQueries({ queryKey: ['loanedToolsForMovement'] });
    queryClient.invalidateQueries({ queryKey: ['ferramentas'] }); // General tool list
    queryClient.invalidateQueries({ queryKey: ['nonConformingTools'] });
    
    toast({ title: "Sucesso!", description: "A operação foi concluída." });

    // Close all dialogs
    setIsRequestDialogOpen(false);
    setIsCheckoutDialogOpen(false);
    setIsCheckInDialogOpen(false);
  };
  
  return (
    <>
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
            loanedTools={loanedTools || []}
            requests={activeRequests}
            isLoading={isLoadingActive}
            error={activeError}
            allTools={allTools}
          />
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
           <ToolMovementHistoryTable
            ref={historyTableRef}
            requests={completedRequests}
            allTools={allTools}
            isLoading={isLoadingCompleted || isLoadingAllTools}
            error={completedError}
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
    </>
  );
};

export default MovementTables;
