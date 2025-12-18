'use client';
import { forwardRef, useImperativeHandle, useState, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
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
import { Loader2, AlertCircle, Inbox, Send } from 'lucide-react';
import { format } from 'date-fns';
import FulfillRequestDialog from './FulfillRequestDialog';
import { useQueryClient } from '@tanstack/react-query';

export interface ToolRequestTableRef {
  refetchRequests: () => void;
}

interface ToolRequestTableProps {
    onActionSuccess: () => void;
}

const ToolRequestTable = forwardRef<ToolRequestTableRef, ToolRequestTableProps>(({ onActionSuccess }, ref) => {
  const firestore = useFirestore();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<WithDocId<ToolRequest> | null>(null);

  const queryKey = ['tool_requests_pending'];
  const requestsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'tool_requests'), where('status', '==', 'Pendente')) : null),
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
  
  const handleFulfillSuccess = () => {
    onActionSuccess();
    setSelectedRequest(null); // Fecha o dialog
  }

  return (
    <>
    <Card>
        <CardHeader>
             <CardTitle>Requisições Pendentes</CardTitle>
             <CardDescription>
                Requisições de ferramentas aguardando retirada pela ferramentaria.
             </CardDescription>
        </CardHeader>
        <CardContent>
             <Table>
                <TableHeader>
                  <TableRow>
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
                      <TableCell colSpan={5} className="text-center">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                      </TableCell>
                    </TableRow>
                  )}
                  {error && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-destructive">
                         <AlertCircle className="inline-block mr-2" /> Erro ao carregar requisições.
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && requests?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center h-24">
                        <Inbox className="mx-auto h-8 w-8 text-muted-foreground mb-2"/>
                        <p className="text-muted-foreground">Nenhuma requisição pendente.</p>
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && requests?.map(request => (
                    <TableRow key={request.docId}>
                      <TableCell className="font-mono">{request.osNumber}</TableCell>
                      <TableCell>{request.requesterName}</TableCell>
                      <TableCell>{format(new Date(request.requestedAt), 'dd/MM/yyyy HH:mm')}</TableCell>
                      <TableCell>
                          <Badge variant="secondary">{request.toolIds.length}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => setSelectedRequest(request)}>
                              <Send className="mr-2 h-4 w-4" />
                              Atender Requisição
                          </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
            </Table>
        </CardContent>
    </Card>
    
    {selectedRequest && (
        <FulfillRequestDialog
            isOpen={!!selectedRequest}
            onClose={() => setSelectedRequest(null)}
            request={selectedRequest}
            onSuccess={handleFulfillSuccess}
        />
    )}
    </>
  );
});

ToolRequestTable.displayName = "ToolRequestTable";

export default ToolRequestTable;
