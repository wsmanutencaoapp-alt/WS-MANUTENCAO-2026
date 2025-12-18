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
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, Inbox } from 'lucide-react';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';

export interface ToolMovementHistoryTableRef {
  refetchHistory: () => void;
}

const getStatusVariant = (status: ToolRequest['status']) => {
    switch (status) {
        case 'Devolvida':
            return 'success';
        case 'Cancelada':
            return 'destructive';
        default:
            return 'secondary';
    }
}


const ToolMovementHistoryTable = forwardRef<ToolMovementHistoryTableRef, {}>((props, ref) => {
  const firestore = useFirestore();
  const queryClient = useQueryClient();

  const queryKey = ['tool_requests_history_completed'];
  const requestsQuery = useMemoFirebase(
    () => (firestore ? query(
        collection(firestore, 'tool_requests'), 
        where('status', 'in', ['Devolvida', 'Cancelada']),
    ) : null),
    [firestore]
  );
  
  const { data: requests, isLoading, error } = useCollection<WithDocId<ToolRequest>>(requestsQuery, {
      queryKey
  });

  const sortedRequests = useMemo(() => {
    if (!requests) return [];
    return [...requests].sort((a, b) => {
      const dateA = a.returnedAt || a.handledAt || a.requestedAt;
      const dateB = b.returnedAt || b.handledAt || b.requestedAt;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  }, [requests]);


  useImperativeHandle(ref, () => ({
    refetchHistory() {
      queryClient.invalidateQueries({ queryKey });
    }
  }));
  
  return (
    <Card>
        <CardHeader>
             <CardTitle>Histórico de Movimentações</CardTitle>
             <CardDescription>
                Visualize todos os empréstimos de ferramentas concluídos (devolvidos, cancelados, etc).
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                      </TableCell>
                    </TableRow>
                  )}
                  {error && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-destructive">
                         <AlertCircle className="inline-block mr-2" /> Erro ao carregar histórico.
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && sortedRequests.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center h-24">
                        <Inbox className="mx-auto h-8 w-8 text-muted-foreground mb-2"/>
                        <p className="text-muted-foreground">Nenhum histórico de movimentação encontrado.</p>
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
                    </TableRow>
                  ))}
                </TableBody>
            </Table>
        </CardContent>
    </Card>
  );
});

ToolMovementHistoryTable.displayName = "ToolMovementHistoryTable";

export default ToolMovementHistoryTable;
