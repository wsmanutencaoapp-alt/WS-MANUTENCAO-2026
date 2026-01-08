'use client';
import { forwardRef, useImperativeHandle, useState, useMemo, useEffect } from 'react';
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, where, orderBy, documentId } from 'firebase/firestore';
import type { ToolRequest, Tool, Employee } from '@/lib/types';
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
import { Loader2, AlertCircle, Inbox, Send, Undo2, Search, ChevronDown, ChevronUp, Settings } from 'lucide-react';
import { format } from 'date-fns';
import FulfillRequestDialog from './FulfillRequestDialog';
import ManualCheckInDialog from './ManualCheckInDialog';
import { useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import Image from 'next/image';
import ManageRequestDialog from './ManageRequestDialog';

export interface ToolRequestTableRef {
  refetchRequests: () => void;
}

interface ToolRequestTableProps {
    onActionSuccess: () => void;
    loanedTools: WithDocId<Tool>[];
    requests: WithDocId<ToolRequest>[] | undefined;
    isLoading: boolean;
    error: Error | null;
    allTools: WithDocId<Tool>[] | undefined;
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

const RequestRow = ({ request, onFulfill, onReturn, onManage, allTools, openCollapsibleId, setOpenCollapsibleId, isAdmin }: { request: WithDocId<ToolRequest>, onFulfill: (req: WithDocId<ToolRequest>) => void, onReturn: (req: WithDocId<ToolRequest>) => void, onManage: (req: WithDocId<ToolRequest>) => void, allTools: WithDocId<Tool>[] | undefined, openCollapsibleId: string | null, setOpenCollapsibleId: (id: string | null) => void, isAdmin: boolean }) => {
    const isOpen = openCollapsibleId === request.docId;
    const toolsInRequest = useMemo(() => {
        if (!allTools || !request.toolIds) return [];
        const requestToolIds = new Set(request.toolIds);
        return allTools.filter(tool => requestToolIds.has(tool.docId));
    }, [allTools, request.toolIds]);
    
    return (
        <>
            <TableRow 
                onClick={() => setOpenCollapsibleId(isOpen ? null : request.docId)}
                className="cursor-pointer"
            >
                <TableCell>
                    <Badge variant={getStatusVariant(request.status)}>{request.status}</Badge>
                </TableCell>
                <TableCell className="font-mono">{request.osNumber}</TableCell>
                <TableCell>{request.requesterName}</TableCell>
                <TableCell>{format(new Date(request.requestedAt), 'dd/MM/yyyy HH:mm')}</TableCell>
                <TableCell className="text-center">
                    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </TableCell>
                <TableCell className="text-right">
                    {request.status === 'Pendente' && (
                        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onFulfill(request); }}>
                            <Send className="mr-2 h-4 w-4" />
                            Atender
                        </Button>
                    )}
                    {request.status === 'Em Uso' && (
                        <Button variant="default" size="sm" onClick={(e) => { e.stopPropagation(); onReturn(request); }}>
                            <Undo2 className="mr-2 h-4 w-4" />
                            Devolver
                        </Button>
                    )}
                     {isAdmin && (
                        <Button variant="ghost" size="icon" className="ml-2" onClick={(e) => { e.stopPropagation(); onManage(request); }}>
                            <Settings className="h-4 w-4" />
                        </Button>
                    )}
                </TableCell>
            </TableRow>
            {isOpen && (
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableCell colSpan={6} className="p-0">
                       <div className="p-4">
                           <h4 className="font-semibold text-sm mb-2">Ferramentas na Requisição:</h4>
                           <div className="space-y-2 max-h-48 overflow-y-auto">
                               {toolsInRequest.length > 0 ? toolsInRequest.map(tool => (
                                   <div key={tool.docId} className="flex items-center gap-3 p-2 border rounded-md bg-background">
                                       <Image
                                           src={tool.imageUrl || "https://picsum.photos/seed/tool/40/40"}
                                           alt={tool.descricao}
                                           width={40}
                                           height={40}
                                           className="aspect-square rounded-md object-cover"
                                       />
                                       <div className="flex-1 text-sm">
                                           <p className="font-bold">{tool.descricao}</p>
                                           <p className="font-mono text-xs text-muted-foreground">{tool.codigo}</p>
                                       </div>
                                       <Badge variant="outline">{tool.enderecamento}</Badge>
                                   </div>
                               )) : (
                                   <p className="text-xs text-muted-foreground text-center">Detalhes das ferramentas não encontrados.</p>
                               )}
                           </div>
                       </div>
                    </TableCell>
                </TableRow>
            )}
        </>
    );
};


const ToolRequestTable = forwardRef<ToolRequestTableRef, ToolRequestTableProps>(({ onActionSuccess, loanedTools, requests, isLoading, error, allTools }, ref) => {
  const { user } = useUser();
  const firestore = useFirestore();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [openCollapsibleId, setOpenCollapsibleId] = useState<string | null>(null);
  const [selectedRequestForFulfillment, setSelectedRequestForFulfillment] = useState<WithDocId<ToolRequest> | null>(null);
  const [selectedRequestForReturn, setSelectedRequestForReturn] = useState<WithDocId<ToolRequest> | null>(null);
  const [selectedRequestForManagement, setSelectedRequestForManagement] = useState<WithDocId<ToolRequest> | null>(null);

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'employees', user.uid) : null),
    [firestore, user]
  );
  const { data: employeeData, isLoading: isEmployeeLoading } = useDoc<Employee>(userDocRef);
  const isAdmin = useMemo(() => employeeData?.accessLevel === 'Admin', [employeeData]);

  const filteredRequests = useMemo(() => {
    if (!requests) return [];
    
    let sortedRequests = [...requests].sort((a, b) => {
      if (a.status === 'Pendente' && b.status !== 'Pendente') return -1;
      if (a.status !== 'Pendente' && b.status === 'Pendente') return 1;
      return new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime();
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
    setSelectedRequestForManagement(null);
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
                Requisições de ferramentas pendentes de atendimento ou atualmente em uso. Clique em uma linha para ver os itens.
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
                    <TableHead className="text-center w-16">Ferramentas</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading || isEmployeeLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                      </TableCell>
                    </TableRow>
                  ) : error ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-destructive">
                         <AlertCircle className="inline-block mr-2" /> Erro ao carregar requisições.
                      </TableCell>
                    </TableRow>
                  ) : filteredRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center h-24">
                        <Inbox className="mx-auto h-8 w-8 text-muted-foreground mb-2"/>
                        <p className="text-muted-foreground">Nenhuma requisição ativa encontrada.</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRequests.map(request => (
                        <RequestRow
                            key={request.docId}
                            request={request}
                            onFulfill={setSelectedRequestForFulfillment}
                            onReturn={setSelectedRequestForReturn}
                            onManage={setSelectedRequestForManagement}
                            allTools={allTools}
                            openCollapsibleId={openCollapsibleId}
                            setOpenCollapsibleId={setOpenCollapsibleId}
                            isAdmin={isAdmin}
                        />
                    ))
                  )}
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

    {selectedRequestForManagement && (
        <ManageRequestDialog
            isOpen={!!selectedRequestForManagement}
            onClose={() => setSelectedRequestForManagement(null)}
            request={selectedRequestForManagement}
            onSuccess={handleActionSuccess}
        />
    )}
    </>
  );
});

ToolRequestTable.displayName = "ToolRequestTable";

export default ToolRequestTable;
