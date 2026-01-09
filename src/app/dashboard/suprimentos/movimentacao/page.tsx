'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import type { SupplyMovement, Supply, SupplyStock } from '@/lib/types';
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
  stockInfo?: Partial<Pick<SupplyStock, 'custoUnitario' | 'loteInterno'>>;
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
    
    // We need to fetch all stock items to get cost and lot info. This can be inefficient at scale.
    // For a real-world app, cost/lot info might be denormalized onto the movement document itself.
    const [allStock, setAllStock] = useState<Map<string, WithDocId<SupplyStock>>>(new Map());
    const [isStockLoading, setIsStockLoading] = useState(true);

    useMemo(() => {
        if (!supplies || !firestore) return;

        const fetchAllStock = async () => {
            setIsStockLoading(true);
            const stockMap = new Map<string, WithDocId<SupplyStock>>();
            for (const supply of supplies) {
                const stockCollectionRef = collection(firestore, 'supplies', supply.docId, 'stock');
                const stockSnapshot = await getDocs(stockCollectionRef);
                stockSnapshot.forEach(doc => {
                    // Key is `supplyId/stockId`
                    stockMap.set(`${supply.docId}/${doc.id}`, { ...doc.data() as SupplyStock, docId: doc.id });
                });
            }
            setAllStock(stockMap);
            setIsStockLoading(false);
        };

        fetchAllStock();
    }, [supplies, firestore]);

    const enrichedHistory = useMemo((): EnrichedMovement[] => {
        if (!movements || !supplies || !allStock) return [];
        const suppliesMap = new Map(supplies.map(s => [s.codigo, s]));
        
        return movements.map(movement => {
            const stockInfo = allStock.get(`${movement.supplyId}/${movement.supplyStockId}`);
            return {
                ...movement,
                supplyInfo: suppliesMap.get(movement.supplyCodigo),
                stockInfo: {
                    custoUnitario: stockInfo?.custoUnitario,
                    loteInterno: stockInfo?.loteInterno
                }
            }
        });
    }, [movements, supplies, allStock]);

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
            (item.loteFornecedor?.toLowerCase() || '').includes(lowercasedTerm) ||
            (item.stockInfo?.loteInterno?.toLowerCase() || '').includes(lowercasedTerm)
        );
    }, [enrichedHistory, searchTerm]);

    const isLoading = isLoadingMovements || isLoadingSupplies || isStockLoading;
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
                           placeholder="Pesquisar por item, usuário, OS, NF-e, lote..."
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
                                <TableHead className="w-28">Tipo</TableHead>
                                <TableHead>Data</TableHead>
                                <TableHead>Item (Código)</TableHead>
                                <TableHead>Lote</TableHead>
                                <TableHead>Quantidade</TableHead>
                                <TableHead>Valor Total</TableHead>
                                <TableHead>Usuário</TableHead>
                                <TableHead>Origem/Destino</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading && (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-24 text-center">
                                        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                                    </TableCell>
                                </TableRow>
                            )}
                            {error && (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-24 text-center text-destructive">
                                        Erro ao carregar histórico: {error.message}
                                    </TableCell>
                                </TableRow>
                            )}
                            {!isLoading && filteredHistory.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-24 text-center">
                                         <Inbox className="mx-auto h-8 w-8 text-muted-foreground mb-2"/>
                                         <p className="text-muted-foreground">Nenhum movimento encontrado.</p>
                                    </TableCell>
                                </TableRow>
                            )}
                            {!isLoading && filteredHistory.map((item) => {
                                const isEntrada = item.type === 'entrada';
                                const totalValue = (item.stockInfo?.custoUnitario || 0) * item.quantity;
                                return (
                                    <TableRow key={item.docId} className={cn(
                                        isEntrada ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'
                                    )}>
                                        <TableCell>
                                            <Badge variant={isEntrada ? 'success' : 'destructive'}>
                                                {isEntrada ? 
                                                    <ArrowDownCircle className="mr-1 h-3.5 w-3.5" /> : 
                                                    <ArrowUpCircle className="mr-1 h-3.5 w-3.5" />
                                                }
                                                {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{format(new Date(item.date), 'dd/MM/yyyy HH:mm')}</TableCell>
                                        <TableCell>
                                            <div className="font-medium">{item.supplyInfo?.descricao || 'Item não encontrado'}</div>
                                            <div className="text-sm text-muted-foreground font-mono">{item.supplyCodigo}</div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-mono text-sm">{item.stockInfo?.loteInterno || 'N/A'}</div>
                                            {item.loteFornecedor && <div className="font-mono text-xs text-muted-foreground">F: {item.loteFornecedor}</div>}
                                        </TableCell>
                                        <TableCell className="font-bold">{item.quantity.toLocaleString()}</TableCell>
                                        <TableCell>
                                            {totalValue > 0 ? totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'N/A'}
                                        </TableCell>
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
