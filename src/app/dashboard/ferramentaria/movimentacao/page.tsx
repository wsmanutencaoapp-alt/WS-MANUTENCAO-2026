'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import ToolMovementTable from '@/components/ToolMovementTable';
import { Button } from '@/components/ui/button';
import { ListChecks, Send, Wrench, Loader2 } from 'lucide-react';
import ToolLoanRequestDialog from '@/components/ToolLoanRequestDialog';
import ToolRequestTable, { ToolRequestTableRef } from '@/components/ToolRequestTable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Tool } from '@/lib/types';
import { ToolingAlertHeader } from '@/components/ToolingAlertHeader';

const MovimentacaoFerramentaria = () => {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  
  const requestTableRef = useRef<ToolRequestTableRef>(null);

  const toolsCollectionRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'tools') : null),
    [firestore]
  );
  
  const { data: ferramentas, isLoading, error } = useCollection<Tool>(toolsCollectionRef);

  const handleActionSuccess = () => {
    // A tabela de requisições será atualizada pelo useCollection,
    // mas podemos forçar um refresh se o componente filho expor uma função.
    if (requestTableRef.current) {
        requestTableRef.current.refetchRequests();
    }
    // A lista principal de ferramentas é atualizada em tempo real.
    toast({ title: "Sucesso!", description: "A operação foi concluída." });
    setIsRequestDialogOpen(false);
  };
  
  useEffect(() => {
    if(error){
        toast({ variant: 'destructive', title: 'Erro ao buscar equipamentos', description: 'Você pode não ter permissão para ver estes dados.'})
    }
  }, [error, toast]);

  const availableTools = ferramentas?.filter(t => t.status === 'Available') || [];

  if (isLoading) {
    return (
        <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Carregando dados de Ferramentaria...</span>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <ToolingAlertHeader />
      <h1 className="text-2xl font-bold flex items-center">
        <Wrench className="h-6 w-6 mr-2" /> Controle de Entrada e Saída de Ferramentas
      </h1>
      
      <div className="flex justify-end">
        <Button onClick={() => setIsRequestDialogOpen(true)}>
          <Send className="mr-2 h-4 w-4" /> Solicitar Empréstimo
        </Button>
      </div>
      
      <Tabs defaultValue="requisicoes">
        <TabsList>
          <TabsTrigger value="requisicoes">
            <ListChecks className="mr-2 h-4 w-4" /> Requisições Pendentes
          </TabsTrigger>
          <TabsTrigger value="movimentacao">
            <Wrench className="mr-2 h-4 w-4" /> Registrar Movimentação Manual
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="requisicoes" className="mt-4">
          <ToolRequestTable 
            ref={requestTableRef}
            onActionSuccess={handleActionSuccess}
          />
        </TabsContent>
        
        <TabsContent value="movimentacao" className="mt-4">
          <ToolMovementTable allTools={ferramentas || []} />
        </TabsContent>
      </Tabs>
      
      <ToolLoanRequestDialog 
        isOpen={isRequestDialogOpen}
        onClose={() => setIsRequestDialogOpen(false)}
        allAvailableTools={availableTools}
        onActionSuccess={handleActionSuccess}
      />
    </div>
  );
};

export default MovimentacaoFerramentaria;
