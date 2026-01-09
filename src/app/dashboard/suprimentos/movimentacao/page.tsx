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
import { Loader2, Search, Inbox, ArrowDownCircle, ArrowUpCircle, Undo } from 'lucide-react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import ReturnMovementDialog from '@/components/ReturnMovementDialog';
import { useQueryClient } from '@tanstack/react-query';


type EnrichedMovement = WithDocId<SupplyMovement> & {
  supplyInfo?: Pick<Supply, 'descricao' | 'imageUrl'>;
  stockInfo?: Partial<Pick<SupplyStock, 'custoUnitario' | 'loteInterno'>>;
};

export default function MovimentacaoMateriaisPage() {
    const firestore = useFirestore();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [returnDialogState, setReturnDialogState] = useState<{ isOpen: boolean; movement: EnrichedMovement | null }>({ isOpen: false, movement: null });

    const movementsQueryKey = ['supplyMovementsHistory'];
    const movementsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'supply_movements'), orderBy('date', 'desc'));
    }, [firestore]);
    const { data: movements, isLoading: isLoadingMovements, error: movementsError } = useCollection<WithDocId<SupplyMovement>>(movementsQuery, { queryKey: movementsQueryKey });

    const suppliesQueryKey = ['allSuppliesForHistory'];
    const suppliesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'supplies'));
    }, [firestore]);
    const { data: supplies, isLoading: isLoadingSupplies, error: suppliesError } = useCollection<WithDocId<Supply>>(suppliesQuery, { queryKey: suppliesQueryKey });
    
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
            const supplyInfo = suppliesMap.get(movement.supplyCodigo);
            return {
                ...movement,
                supplyInfo: {
                    descricao: supplyInfo?.descricao || 'Item não encontrado',
                    imageUrl: supplyInfo?.imageUrl
                },
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
    
    const handleReturnSuccess = () => {
      queryClient.invalidateQueries({ queryKey: movementsQueryKey });
      queryClient.invalidateQueries({ queryKey: ['suppliesMasterDataForStockList'] }); // Invalidate stock list on another page
      setReturnDialogState({isOpen: false, movement: null });
    }

    const isLoading = isLoadingMovements || isLoadingSupplies || isStockLoading;
    const error = movementsError || suppliesError;

    const getBadge = (type: SupplyMovement['type']) => {
        switch(type) {
            case 'entrada': return <Badge variant="success"><ArrowDownCircle className="mr-1 h-3.5 w-3.5" />Entrada</Badge>;
            case 'saida': return <Badge variant="destructive"><ArrowUpCircle className="mr-1 h-3.5 w-3.5" />Saída</Badge>;
            case 'devolucao': return <Badge variant="warning"><Undo className="mr-1 h-3.5 w-3.5" />Devolução</Badge>;
            default: return <Badge variant="secondary">{type}</Badge>;
        }
    }

    return (
      <>
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
                                <TableHead className="w-32">Tipo</TableHead>
                                <TableHead>Data</TableHead>
                                <TableHead>Item (Código)</TableHead>
                                <TableHead>Lote</TableHead>
                                <TableHead>Quantidade</TableHead>
                                <TableHead>Valor Total</TableHead>
                                <TableHead>Usuário</TableHead>
                                <TableHead>Origem/Destino</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading && (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-24 text-center">
                                        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                                    </TableCell>
                                </TableRow>
                            )}
                            {error && (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-24 text-center text-destructive">
                                        Erro ao carregar histórico: {error.message}
                                    </TableCell>
                                </TableRow>
                            )}
                            {!isLoading && filteredHistory.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-24 text-center">
                                         <Inbox className="mx-auto h-8 w-8 text-muted-foreground mb-2"/>
                                         <p className="text-muted-foreground">Nenhum movimento encontrado.</p>
                                    </TableCell>
                                </TableRow>
                            )}
                            {!isLoading && filteredHistory.map((item) => {
                                const totalValue = (item.stockInfo?.custoUnitario || 0) * item.quantity;
                                return (
                                    <TableRow key={item.docId}>
                                        <TableCell>{getBadge(item.type)}</TableCell>
                                        <TableCell>{format(new Date(item.date), 'dd/MM/yyyy HH:mm')}</TableCell>
                                        <TableCell>
                                            <div className="font-medium">{item.supplyInfo?.descricao}</div>
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
                                        <TableCell>{item.type === 'entrada' || item.type === 'devolucao' ? item.origin : item.destination}</TableCell>
                                        <TableCell className="text-right">
                                            {item.type === 'saida' && (
                                                <Button variant="outline" size="sm" onClick={() => setReturnDialogState({ isOpen: true, movement: item })}>
                                                    <Undo className="mr-2 h-3.5 w-3.5"/>
                                                    Devolver
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )}
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>

        {returnDialogState.isOpen && (
            <ReturnMovementDialog 
                isOpen={returnDialogState.isOpen}
                onClose={() => setReturnDialogState({ isOpen: false, movement: null })}
                movement={returnDialogState.movement}
                onSuccess={handleReturnSuccess}
            />
        )}
      </>
    );
}
