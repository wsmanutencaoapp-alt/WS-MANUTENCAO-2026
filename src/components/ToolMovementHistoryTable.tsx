'use client';
import { forwardRef, useImperativeHandle, useState, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { ToolRequest } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, Inbox, Undo2 } from 'lucide-react';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import ReturnLoanDialog from './ReturnLoanDialog';

export interface ToolMovementHistoryTableRef {
  refetchHistory: () => void;
}

interface ToolMovementHistoryTableProps {
    onActionSuccess: () => void;
}

const getStatusVariant = (status: ToolRequest['status']) => {
    switch (status) {
        case 'Em Uso':
            return 'default';
        case 'Devolvida':
            return 'success';
        case 'Cancelada':
            return 'destructive';
        default:
            return 'secondary';
    }
}


const ToolMovementHistoryTable = forwardRef<ToolMovementHistoryTableRef, ToolMovementHistoryTableProps>(({ onActionSuccess }, ref) => {
  const firestore = useFirestore();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<WithDocId<ToolRequest> | null>(null);

  const queryKey = ['tool_requests_history'];
  const requestsQuery = useMemoFirebase(
    () => (firestore ? query(
        collection(firestore, 'tool_requests'), 
        where('status', '!=', 'Pendente'),
        orderBy('status')
        // orderBy('requestedAt', 'desc') // REMOVIDO: Firestore não permite múltiplos orderBy com filtro de desigualdade
    ) : null),
    [firestore]
  );
  
  const { data: requests, isLoading, error } = useCollection<WithDocId<ToolRequest>>(requestsQuery, {
      queryKey
  });

  // Ordenação do lado do cliente como uma solução alternativa
  const sortedRequests = useMemo(() => {
    if (!requests) return [];
    return [...requests].sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
  }, [requests]);


  useImperativeHandle(ref, () => ({
    refetchHistory() {
      queryClient.invalidateQueries({ queryKey });
    }
  }));

  const handleReturnSuccess = () => {
    onActionSuccess();
    setSelectedRequest(null);
  };
  
  return (
    <>
    <Card>
        <CardHeader>
             <CardTitle>Histórico de Movimentações</CardTitle>
             <CardDescription>
                Visualize todos os empréstimos de ferramentas (em uso, devolvidos, etc).
             </CardDescription>
        </CardHeader>
        <CardContent>
             <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Nº da OS</TableHead>
                    <TableHead>Solicitante</TableHead>
                    <TableHead>Data Retirada</TableHead>
                    <TableHead>Data Devolução</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                      </TableCell>
                    </TableRow>
                  )}
                  {error && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-destructive">
                         <AlertCircle className="inline-block mr-2" /> Erro ao carregar histórico.
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && sortedRequests.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center h-24">
                        <Inbox className="mx-auto h-8 w-8 text-muted-foreground mb-2"/>
                        <p className="text-muted-foreground">Nenhuma movimentação registrada.</p>
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && sortedRequests.map(request => (
                    <TableRow key={request.docId}>
                      <TableCell>
                          <Badge variant={getStatusVariant(request.status)}>{request.status}</Badge>
                      </TableCell>
                      <TableCell className="font-mono">{request.osNumber}</TableCell>
                      <TableCell>{request.requesterName}</TableCell>
                      <TableCell>{request.handledAt ? format(new Date(request.handledAt), 'dd/MM/yyyy') : 'N/A'}</TableCell>
                      <TableCell>{request.returnedAt ? format(new Date(request.returnedAt), 'dd/MM/yyyy') : 'N/A'}</TableCell>
                      <TableCell className="text-right">
                          {request.status === 'Em Uso' && (
                            <Button variant="outline" size="sm" onClick={() => setSelectedRequest(request)}>
                                <Undo2 className="mr-2 h-4 w-4" />
                                Registrar Devolução
                            </Button>
                          )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
            </Table>
        </CardContent>
    </Card>
    
    {selectedRequest && (
        <ReturnLoanDialog
            isOpen={!!selectedRequest}
            onClose={() => setSelectedRequest(null)}
            request={selectedRequest}
            onSuccess={handleReturnSuccess}
        />
    )}
    </>
  );
});

ToolMovementHistoryTable.displayName = "ToolMovementHistoryTable";

export default ToolMovementHistoryTable;
