'use client';

import { useMemo, useState } from 'react';
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
import { Loader2, Search, AlertCircle, Inbox } from 'lucide-react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';

type NonConformingHistoryItem = {
    toolId: string;
    toolCode: string;
    toolDescription: string;
    identifiedAt: string; // From returnedAt
    identifiedBy: string; // From requesterName
    observation: string; // From returnConditions.observacao
    finalStatus: 'Recuperada' | 'Descartada';
    finalStatusAt: string; // From data_descarte or a new field
};


export default function HistoricoNaoConformesPage() {
    const firestore = useFirestore();
    const [searchTerm, setSearchTerm] = useState('');

    // 1. Get all tools that have been or are non-conforming
    const toolsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'tools')); // Get all tools to build a map
    }, [firestore]);
    const { data: allTools, isLoading: isLoadingTools, error: toolsError } = useCollection<WithDocId<Tool>>(toolsQuery, { queryKey: ['allToolsForHistoryNC'] });

    // 2. Get all returned requests to find the origin of non-conformity
    const requestsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'tool_requests'), 
            where('status', '==', 'Devolvida'),
            orderBy('returnedAt', 'desc')
        );
    }, [firestore]);
    const { data: allRequests, isLoading: isLoadingRequests, error: requestsError } = useCollection<WithDocId<ToolRequest>>(requestsQuery, { queryKey: ['allReturnedRequestsForHistoryNC'] });
    
    // 3. Combine data to build the history
    const historyItems = useMemo((): NonConformingHistoryItem[] => {
        if (!allTools || !allRequests) return [];
        const toolsMap = new Map(allTools.map(t => [t.docId, t]));
        const history: NonConformingHistoryItem[] = [];

        // Process items from returned requests
        for (const request of allRequests) {
            if (!request.returnConditions) continue;
            for (const toolId in request.returnConditions) {
                const condition = request.returnConditions[toolId];
                if (condition.visual === 'nok' || condition.funcional === 'nok') {
                    const tool = toolsMap.get(toolId);
                    if (!tool) continue;
                    
                    history.push({
                        toolId: tool.docId,
                        toolCode: tool.codigo,
                        toolDescription: tool.descricao,
                        identifiedAt: request.returnedAt || request.requestedAt,
                        identifiedBy: request.requesterName,
                        observation: condition.observacao,
                        finalStatus: tool.status === 'Refugo' ? 'Descartada' : 'Recuperada',
                        finalStatusAt: tool.data_descarte || 'N/A', // Needs a 'repairedAt' field for full accuracy
                    });
                }
            }
        }

        // Process tools that were directly marked as "Refugo" without a request
        for(const tool of allTools) {
            if (tool.status === 'Refugo' && !history.some(h => h.toolId === tool.docId)) {
                 history.push({
                    toolId: tool.docId,
                    toolCode: tool.codigo,
                    toolDescription: tool.descricao,
                    identifiedAt: tool.data_descarte || 'N/A',
                    identifiedBy: 'N/A (Descarte Direto)',
                    observation: tool.motivo_descarte || 'Motivo não especificado',
                    finalStatus: 'Descartada',
                    finalStatusAt: tool.data_descarte || 'N/A',
                });
            }
        }
        
        return history.sort((a,b) => new Date(b.identifiedAt).getTime() - new Date(a.identifiedAt).getTime());

    }, [allTools, allRequests]);

    const filteredHistory = useMemo(() => {
        if (!historyItems) return [];
        if (!searchTerm) return historyItems;
        const lowercasedTerm = searchTerm.toLowerCase();
        return historyItems.filter(item => 
            item.toolCode.toLowerCase().includes(lowercasedTerm) ||
            item.toolDescription.toLowerCase().includes(lowercasedTerm) ||
            item.identifiedBy.toLowerCase().includes(lowercasedTerm) ||
            item.observation.toLowerCase().includes(lowercasedTerm)
        );
    }, [historyItems, searchTerm]);

    const isLoading = isLoadingTools || isLoadingRequests;
    const error = toolsError || requestsError;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Histórico de Não Conformidades</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Rastreabilidade de Ferramentas</CardTitle>
                    <CardDescription>
                        Visualize o ciclo de vida completo de ferramentas que apresentaram avarias.
                    </CardDescription>
                     <div className="relative pt-4">
                       <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                       <Input
                           placeholder="Pesquisar por ferramenta, solicitante, observação..."
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
                                <TableHead>Ferramenta</TableHead>
                                <TableHead>Identificação da Avaria</TableHead>
                                <TableHead>Devolvido Por</TableHead>
                                <TableHead>Observação</TableHead>
                                <TableHead>Ação Final</TableHead>
                                <TableHead>Data da Ação</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading && (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                                    </TableCell>
                                </TableRow>
                            )}
                            {error && (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-destructive">
                                        <AlertCircle className="inline-block mr-2" />
                                        Erro ao carregar histórico: {error.message}
                                    </TableCell>
                                </TableRow>
                            )}
                            {!isLoading && filteredHistory.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                         <Inbox className="mx-auto h-8 w-8 text-muted-foreground mb-2"/>
                                         <p className="text-muted-foreground">Nenhum histórico de não conformidade encontrado.</p>
                                    </TableCell>
                                </TableRow>
                            )}
                            {!isLoading && filteredHistory.map((item, index) => (
                                <TableRow key={`${item.toolId}-${index}`}>
                                    <TableCell>
                                        <div className="font-medium">{item.toolDescription}</div>
                                        <div className="text-sm text-muted-foreground font-mono">{item.toolCode}</div>
                                    </TableCell>
                                    <TableCell>{format(new Date(item.identifiedAt), 'dd/MM/yyyy HH:mm')}</TableCell>
                                    <TableCell>{item.identifiedBy}</TableCell>
                                    <TableCell className="max-w-xs truncate">{item.observation}</TableCell>
                                    <TableCell>
                                        <Badge variant={item.finalStatus === 'Descartada' ? 'destructive' : 'success'}>
                                            {item.finalStatus}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {item.finalStatusAt !== 'N/A' ? format(new Date(item.finalStatusAt), 'dd/MM/yyyy') : 'N/A'}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
