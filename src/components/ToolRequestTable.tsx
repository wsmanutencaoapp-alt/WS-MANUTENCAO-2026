'use client';
import { forwardRef, useImperativeHandle, useState, useMemo, useEffect } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { ToolRequest, Tool } from '@/lib/types';
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
import { Loader2, AlertCircle, Inbox, Send, Undo2, Search } from 'lucide-react';
import { format } from 'date-fns';
import FulfillRequestDialog from './FulfillRequestDialog';
import ManualCheckInDialog from './ManualCheckInDialog';
import { useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';

export interface ToolRequestTableRef {
  refetchRequests: () => void;
}

interface ToolRequestTableProps {
    onActionSuccess: () => void;
    loanedTools: WithDocId<Tool>[];
    requests: WithDocId<ToolRequest>[] | undefined;
    isLoading: boolean;
    error: Error | null;
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

const ToolRequestTable = forwardRef<ToolRequestTableRef, ToolRequestTableProps>(({ onActionSuccess, loanedTools, requests, isLoading, error }, ref) => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequestForFulfillment, setSelectedRequestForFulfillment] = useState<WithDocId<ToolRequest> | null>(null);
  const [selectedRequestForReturn, setSelectedRequestForReturn] = useState<WithDocId<ToolRequest> | null>(null);

  const filteredRequests = useMemo(() => {
    if (!requests) return [];
    
    let sortedRequests = [...requests].sort((a, b) => {
      if (a.status === 'Pendente' && b.status !== 'Pendente') return -1;
      if (a.status !== 'Pendente' && b.status === 'Pendente') return 1;
      return new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime();
    });

    if (!searchTerm) {
        return sortedRequests;
    }

    const lowercasedTerm = searchTerm.toLowerCase();
    return sortedRequests.filter(request => 
        request.osNumber.toLowerCase().includes(lowercasedTerm) ||
        request.requesterName.toLowerCase().includes(lowercasedTerm)
    );

  }, [requests, searchTerm]);

  useImperativeHandle(ref, () => ({
    refetchRequests() {
      queryClient.invalidateQueries({ queryKey: ['tool_requests_active'] });
    }
  }));
  
  const handleActionSuccess = () => {
    onActionSuccess();
    setSelectedRequestForFulfillment(null);
    setSelectedRequestForReturn(null);
  }

  const loanedToolsForRequest = useMemo(() => {
    if (!selectedRequestForReturn) return [];
    const requestToolIds = new Set(selectedRequestForReturn.toolIds);
    return loanedTools.filter(tool => requestToolIds.has(tool.docId));
  }, [selectedRequestForReturn, loanedTools]);


  return (
    <>
    <Card>
        <CardHeader>
             <CardTitle>Requisições Ativas</CardTitle>
             <CardDescription>
                Requisições de ferramentas pendentes de atendimento ou atualmente em uso.
             </CardDescription>
             <div className="relative pt-4">
               <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
               <Input
                   placeholder="Pesquisar por OS ou solicitante..."
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[336px]"
               />
            </div>
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
                  {!isLoading && filteredRequests.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center h-24">
                        <Inbox className="mx-auto h-8 w-8 text-muted-foreground mb-2"/>
                        <p className="text-muted-foreground">Nenhuma requisição ativa encontrada.</p>
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && filteredRequests.map(request => (
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
        <ManualCheckInDialog
            isOpen={!!selectedRequestForReturn}
            onClose={() => setSelectedRequestForReturn(null)}
            allLoanedTools={loanedToolsForRequest}
            onActionSuccess={handleActionSuccess}
            preselectedToolIds={selectedRequestForReturn.toolIds}
            isRequestReturn={true}
        />
    )}
    </>
  );
});

ToolRequestTable.displayName = "ToolRequestTable";

export default ToolRequestTable;
