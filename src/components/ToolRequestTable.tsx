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
import { Loader2, AlertCircle, Inbox, Send, Undo2 } from 'lucide-react';
import { format } from 'date-fns';
import FulfillRequestDialog from './FulfillRequestDialog';
import ReturnLoanDialog from './ReturnLoanDialog';
import { useQueryClient } from '@tanstack/react-query';

export interface ToolRequestTableRef {
  refetchRequests: () => void;
}

interface ToolRequestTableProps {
    onActionSuccess: () => void;
}

const getStatusVariant = (status: ToolRequest['status']) => {
    switch (status) {
        case 'Pendente':
            return 'default';
        case 'Em Uso':
            return 'secondary';
        default:
            return 'outline';
    }
}

const ToolRequestTable = forwardRef<ToolRequestTableRef, ToolRequestTableProps>(({ onActionSuccess }, ref) => {
  const firestore = useFirestore();
  const queryClient = useQueryClient();
  const [selectedRequestForFulfillment, setSelectedRequestForFulfillment] = useState<WithDocId<ToolRequest> | null>(null);
  const [selectedRequestForReturn, setSelectedRequestForReturn] = useState<WithDocId<ToolRequest> | null>(null);

  const queryKey = ['tool_requests_active'];
  const requestsQuery = useMemoFirebase(
    () => (firestore ? query(
        collection(firestore, 'tool_requests'), 
        where('status', 'in', ['Pendente', 'Em Uso']),
        orderBy('status', 'desc'),
        orderBy('requestedAt', 'asc'),
    ) : null),
    [firestore]
  );
  
  const { data: requests, isLoading, error } = useCollection<WithDocId<ToolRequest>>(requestsQuery, {
      queryKey
  });

  useImperativeHandle(ref, () => ({
    refetchRequests() {
      queryClient.invalidateQueries({ queryKey });
    }
  }));
  
  const handleActionSuccess = () => {
    onActionSuccess();
    setSelectedRequestForFulfillment(null);
    setSelectedRequestForReturn(null);
  }

  return (
    <>
    <Card>
        <CardHeader>
             <CardTitle>Requisições Ativas</CardTitle>
             <CardDescription>
                Requisições de ferramentas pendentes de atendimento ou atualmente em uso.
             </CardDescription>
        </CardHeader>
        <CardContent>
             <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Nº da OS</TableHead>
                    <TableHead>Solicitante</TableHead>
                    <TableHead>Data da Solicitação</TableHead>
                    <TableHead>Itens</TableHead>
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
                         <AlertCircle className="inline-block mr-2" /> Erro ao carregar requisições.
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && requests?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center h-24">
                        <Inbox className="mx-auto h-8 w-8 text-muted-foreground mb-2"/>
                        <p className="text-muted-foreground">Nenhuma requisição ativa no momento.</p>
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && requests?.map(request => (
                    <TableRow key={request.docId}>
                      <TableCell>
                          <Badge variant={getStatusVariant(request.status)}>{request.status}</Badge>
                      </TableCell>
                      <TableCell className="font-mono">{request.osNumber}</TableCell>
                      <TableCell>{request.requesterName}</TableCell>
                      <TableCell>{format(new Date(request.requestedAt), 'dd/MM/yyyy HH:mm')}</TableCell>
                      <TableCell>
                          <Badge variant="outline">{request.toolIds.length}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                          {request.status === 'Pendente' && (
                            <Button variant="outline" size="sm" onClick={() => setSelectedRequestForFulfillment(request)}>
                                <Send className="mr-2 h-4 w-4" />
                                Atender
                            </Button>
                          )}
                          {request.status === 'Em Uso' && (
                            <Button variant="default" size="sm" onClick={() => setSelectedRequestForReturn(request)}>
                                <Undo2 className="mr-2 h-4 w-4" />
                                Devolver
                            </Button>
                          )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
            </Table>
        </CardContent>
    </Card>
    
    {selectedRequestForFulfillment && (
        <FulfillRequestDialog
            isOpen={!!selectedRequestForFulfillment}
            onClose={() => setSelectedRequestForFulfillment(null)}
            request={selectedRequestForFulfillment}
            onSuccess={handleActionSuccess}
        />
    )}

    {selectedRequestForReturn && (
        <ReturnLoanDialog
            isOpen={!!selectedRequestForReturn}
            onClose={() => setSelectedRequestForReturn(null)}
            request={selectedRequestForReturn}
            onSuccess={handleActionSuccess}
        />
    )}
    </>
  );
});

ToolRequestTable.displayName = "ToolRequestTable";

export default ToolRequestTable;
