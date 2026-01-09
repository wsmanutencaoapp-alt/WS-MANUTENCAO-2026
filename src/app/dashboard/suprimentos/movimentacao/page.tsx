'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { SupplyMovement, Supply } from '@/lib/types';
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
import { Loader2, Search, Inbox, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type EnrichedMovement = WithDocId<SupplyMovement> & {
  supplyInfo?: Pick<Supply, 'descricao'>;
};

export default function MovimentacaoMateriaisPage() {
    const firestore = useFirestore();
    const [searchTerm, setSearchTerm] = useState('');

    const movementsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'supply_movements'), orderBy('date', 'desc'));
    }, [firestore]);
    const { data: movements, isLoading: isLoadingMovements, error: movementsError } = useCollection<WithDocId<SupplyMovement>>(movementsQuery, { queryKey: ['supplyMovementsHistory'] });

    const suppliesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'supplies'));
    }, [firestore]);
    const { data: supplies, isLoading: isLoadingSupplies, error: suppliesError } = useCollection<WithDocId<Supply>>(suppliesQuery, { queryKey: ['allSuppliesForHistory'] });

    const enrichedHistory = useMemo((): EnrichedMovement[] => {
        if (!movements || !supplies) return [];
        const suppliesMap = new Map(supplies.map(s => [s.codigo, s]));
        
        return movements.map(movement => ({
            ...movement,
            supplyInfo: suppliesMap.get(movement.supplyCodigo),
        }));
    }, [movements, supplies]);

    const filteredHistory = useMemo(() => {
        if (!enrichedHistory) return [];
        if (!searchTerm) return enrichedHistory;
        const lowercasedTerm = searchTerm.toLowerCase();
        return enrichedHistory.filter(item => 
            item.supplyCodigo.toLowerCase().includes(lowercasedTerm) ||
            (item.supplyInfo?.descricao?.toLowerCase() || '').includes(lowercasedTerm) ||
            item.responsibleName.toLowerCase().includes(lowercasedTerm) ||
            (item.origin?.toLowerCase() || '').includes(lowercasedTerm) ||
            (item.destination?.toLowerCase() || '').includes(lowercasedTerm) ||
            item.loteFornecedor?.toLowerCase().includes(lowercasedTerm) ||
            item.supplyStockId.toLowerCase().includes(lowercasedTerm)
        );
    }, [enrichedHistory, searchTerm]);

    const isLoading = isLoadingMovements || isLoadingSupplies;
    const error = movementsError || suppliesError;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Histórico de Movimentação de Suprimentos</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Log de Entradas e Saídas</CardTitle>
                    <CardDescription>
                        Visualize todas as movimentações de itens no estoque.
                    </CardDescription>
                     <div className="relative pt-4">
                       <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                       <Input
                           placeholder="Pesquisar por item, usuário, OS, NF-e..."
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
                                <TableHead className="w-16">Tipo</TableHead>
                                <TableHead>Data</TableHead>
                                <TableHead>Item (Código)</TableHead>
                                <TableHead>Quantidade</TableHead>
                                <TableHead>Usuário</TableHead>
                                <TableHead>Origem/Destino</TableHead>
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
                                        Erro ao carregar histórico: {error.message}
                                    </TableCell>
                                </TableRow>
                            )}
                            {!isLoading && filteredHistory.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                         <Inbox className="mx-auto h-8 w-8 text-muted-foreground mb-2"/>
                                         <p className="text-muted-foreground">Nenhum movimento encontrado.</p>
                                    </TableCell>
                                </TableRow>
                            )}
                            {!isLoading && filteredHistory.map((item) => {
                                const isEntrada = item.type === 'entrada';
                                return (
                                    <TableRow key={item.docId} className={cn(
                                        isEntrada ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'
                                    )}>
                                        <TableCell>
                                            <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger>
                                                    <Badge variant={isEntrada ? 'success' : 'destructive'}>
                                                        {isEntrada ? 
                                                            <ArrowDownCircle className="mr-1 h-3.5 w-3.5" /> : 
                                                            <ArrowUpCircle className="mr-1 h-3.5 w-3.5" />
                                                        }
                                                        {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                                                    </Badge>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                <p>Lote Interno: {item.supplyStockId}</p>
                                                {item.loteFornecedor && <p>Lote Fornecedor: {item.loteFornecedor}</p>}
                                                </TooltipContent>
                                            </Tooltip>
                                            </TooltipProvider>
                                        </TableCell>
                                        <TableCell>{format(new Date(item.date), 'dd/MM/yyyy HH:mm')}</TableCell>
                                        <TableCell>
                                            <div className="font-medium">{item.supplyInfo?.descricao || 'Item não encontrado'}</div>
                                            <div className="text-sm text-muted-foreground font-mono">{item.supplyCodigo}</div>
                                        </TableCell>
                                        <TableCell className="font-bold">{item.quantity.toLocaleString()}</TableCell>
                                        <TableCell>{item.responsibleName}</TableCell>
                                        <TableCell>{isEntrada ? item.origin : item.destination}</TableCell>
                                    </TableRow>
                                )}
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}