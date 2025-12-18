'use client';
import { forwardRef, useImperativeHandle, useState, useMemo, useEffect } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Tool, ToolRequest, InspectionResult } from '@/lib/types';
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
import { Loader2, AlertCircle, Inbox, Search, Info } from 'lucide-react';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';


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

type ExpandedHistoryItem = {
  requestId: string;
  toolId: string;
  osNumber: string;
  requesterName: string;
  status: ToolRequest['status'];
  toolCode: string;
  toolDescription: string;
  toolImage?: string;
  handledAt?: string;
  returnedAt?: string;
  returnCondition?: InspectionResult;
};


interface ToolMovementHistoryTableProps {
  requests: WithDocId<ToolRequest>[] | undefined;
  allTools: WithDocId<Tool>[] | undefined;
  isLoading: boolean;
  error: Error | null;
}

const ToolMovementHistoryTable = forwardRef<ToolMovementHistoryTableRef, ToolMovementHistoryTableProps>(({ requests, allTools, isLoading, error }, ref) => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  
  const expandedHistory = useMemo((): ExpandedHistoryItem[] => {
    if (!requests || !allTools) return [];

    const toolsMap = new Map(allTools.map(tool => [tool.docId, tool]));
    
    const historyItems: ExpandedHistoryItem[] = [];

    for (const request of requests) {
        const returnedToolIds = request.returnConditions ? Object.keys(request.returnConditions) : request.toolIds;

        for (const toolId of returnedToolIds) {
            const tool = toolsMap.get(toolId);
            historyItems.push({
                requestId: request.docId,
                toolId: toolId,
                osNumber: request.osNumber,
                requesterName: request.requesterName,
                status: request.status,
                toolCode: tool?.codigo || 'N/A',
                toolDescription: tool?.descricao || 'Ferramenta não encontrada',
                toolImage: tool?.imageUrl,
                handledAt: request.handledAt,
                returnedAt: request.returnedAt,
                returnCondition: request.returnConditions?.[toolId],
            });
        }
    }
    
    return historyItems.sort((a, b) => {
        const dateA = a.returnedAt || a.handledAt || '';
        const dateB = b.returnedAt || b.handledAt || '';
        return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

  }, [requests, allTools]);

  const filteredHistory = useMemo(() => {
      if (!expandedHistory) return [];
      if (!searchTerm) return expandedHistory;
      
      const lowercasedTerm = searchTerm.toLowerCase();
      return expandedHistory.filter(item => 
        item.osNumber.toLowerCase().includes(lowercasedTerm) ||
        item.requesterName.toLowerCase().includes(lowercasedTerm) ||
        item.toolCode.toLowerCase().includes(lowercasedTerm) ||
        item.toolDescription.toLowerCase().includes(lowercasedTerm)
      );

  }, [expandedHistory, searchTerm]);


  useImperativeHandle(ref, () => ({
    refetchHistory() {
      queryClient.invalidateQueries({ queryKey: ['tool_requests_history_completed'] });
    }
  }));
  
  return (
    <Card>
        <CardHeader>
             <CardTitle>Histórico de Movimentações</CardTitle>
             <CardDescription>
                Visualize o extrato de todas as movimentações de ferramentas (saídas e retornos).
             </CardDescription>
             <div className="relative pt-4">
               <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
               <Input
                   placeholder="Pesquisar por OS, solicitante, ferramenta..."
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
                    <TableHead className="w-[100px]">OS</TableHead>
                    <TableHead>Ferramenta</TableHead>
                    <TableHead>Solicitante</TableHead>
                    <TableHead>Data Saída</TableHead>
                    <TableHead>Data Retorno</TableHead>
                    <TableHead>Condição Devolução</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                      </TableCell>
                    </TableRow>
                  )}
                  {error && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-destructive">
                         <AlertCircle className="inline-block mr-2" /> Erro ao carregar histórico.
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && filteredHistory.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center h-24">
                        <Inbox className="mx-auto h-8 w-8 text-muted-foreground mb-2"/>
                        <p className="text-muted-foreground">Nenhum histórico de movimentação encontrado.</p>
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && filteredHistory.map((item, index) => {
                    const isNok = item.returnCondition?.visual === 'nok' || item.returnCondition?.funcional === 'nok';
                    return (
                        <TableRow key={`${item.requestId}-${item.toolId}-${index}`}>
                        <TableCell className="font-mono">{item.osNumber}</TableCell>
                        <TableCell>
                            <div>
                                <p className="font-bold">{item.toolDescription}</p>
                                <p className="font-mono text-xs text-muted-foreground">{item.toolCode}</p>
                            </div>
                        </TableCell>
                        <TableCell>{item.requesterName}</TableCell>
                        <TableCell>{item.handledAt ? format(new Date(item.handledAt), 'dd/MM/yyyy') : 'N/A'}</TableCell>
                        <TableCell>{item.returnedAt ? format(new Date(item.returnedAt), 'dd/MM/yyyy') : 'N/A'}</TableCell>
                        <TableCell>
                            {item.returnCondition ? (
                                isNok ? (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Badge variant="destructive" className="cursor-help">
                                                NOK <Info className="ml-1 h-3 w-3"/>
                                            </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p className="max-w-xs">{item.returnCondition.observacao}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                ) : (
                                    <Badge variant="success">OK</Badge>
                                )
                            ) : (
                                <Badge variant="secondary">N/A</Badge>
                            )}
                        </TableCell>
                        <TableCell>
                            <Badge variant={getStatusVariant(item.status)}>{item.status}</Badge>
                        </TableCell>
                        </TableRow>
                    )
                  })}
                </TableBody>
            </Table>
        </CardContent>
    </Card>
  );
});

ToolMovementHistoryTable.displayName = "ToolMovementHistoryTable";

export default ToolMovementHistoryTable;
