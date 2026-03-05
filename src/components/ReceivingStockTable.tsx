'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collectionGroup, query, where, doc, updateDoc, writeBatch, collection, getDocs, documentId } from 'firebase/firestore';
import type { SupplyStock, Tool, Address, Supply } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, PackageCheck, Search, Check, ChevronsUpDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Label } from './ui/label';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Badge } from './ui/badge';
import Image from 'next/image';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { StoreItemDialog } from './StoreItemDialog';


type ReceivingItem = (WithDocId<SupplyStock> | WithDocId<Tool>) & { 
    itemType: 'supply' | 'tool',
    descricao?: string,
    codigo?: string,
    loteInterno?: string,
    dataEntrada?: string,
    imageUrl?: string,
};


export default function ReceivingStockTable() {
    const firestore = useFirestore();
    const queryClient = useQueryClient();
    
    const [selectedItem, setSelectedItem] = useState<ReceivingItem | null>(null);

    // Fetch only the supply stock items in receiving status
    const supplyStockQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collectionGroup(firestore, 'stock'), where('status', '==', 'Em Recebimento'));
    }, [firestore]);
    const { data: receivingSupplies, isLoading: isLoadingSupplies, error: suppliesError } = useCollection<WithDocId<SupplyStock>>(supplyStockQuery, {
        queryKey: ['receivingStockSupplies']
    });

    // Fetch only the tools in receiving status
    const toolsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'tools'), where('status', '==', 'Em Recebimento'));
    }, [firestore]);
    const { data: receivingTools, isLoading: isLoadingTools, error: toolsError } = useCollection<WithDocId<Tool>>(toolsQuery, {
        queryKey: ['receivingStockTools']
    });
    
    // NEW: get supply IDs from receivingSupplies
    const supplyIdsInReceiving = useMemo(() => {
        if (!receivingSupplies) return [];
        return [...new Set(receivingSupplies.map(item => item.path.split('/')[1]))];
    }, [receivingSupplies]);

    // NEW: Fetch only the needed supplies
    const neededSuppliesQuery = useMemoFirebase(() => {
        if (!firestore || supplyIdsInReceiving.length === 0) return null;
        return query(collection(firestore, 'supplies'), where(documentId(), 'in', supplyIdsInReceiving));
    }, [firestore, supplyIdsInReceiving]);
    const { data: neededSupplies, isLoading: isLoadingNeededSupplies } = useCollection<WithDocId<Supply>>(neededSuppliesQuery, {
        queryKey: ['neededSuppliesForReceiving', supplyIdsInReceiving.join(',')],
        enabled: supplyIdsInReceiving.length > 0,
    });


    // Use useMemo for efficient, client-side enrichment
    const enrichedSupplies = useMemo(() => {
        if (!receivingSupplies || !neededSupplies) return [];
        const supplyMap = new Map(neededSupplies.map(s => [s.docId, s]));

        return receivingSupplies.map(stockItem => {
            const supplyId = stockItem.path.split('/')[1];
            const supplyData = supplyMap.get(supplyId);
            return {
                ...stockItem,
                itemType: 'supply' as const,
                descricao: supplyData?.descricao || 'N/A',
                codigo: supplyData?.codigo || 'N/A',
                imageUrl: supplyData?.imageUrl,
                supplyId: supplyId,
            };
        });
    }, [receivingSupplies, neededSupplies]);
    
    const allReceivingItems: ReceivingItem[] = useMemo(() => {
        const toolsWithType: ReceivingItem[] = receivingTools?.map(t => ({...t, itemType: 'tool' as const})) || [];
        return [...enrichedSupplies, ...toolsWithType].sort((a,b) => {
            const dateA = new Date((a as any).dataEntrada || a.createdAt || 0).getTime();
            const dateB = new Date((b as any).dataEntrada || b.createdAt || 0).getTime();
            return dateB - dateA;
        });
    }, [enrichedSupplies, receivingTools]);
    
    const handleSuccess = () => {
        queryClient.invalidateQueries({ queryKey: ['receivingStockSupplies'] });
        queryClient.invalidateQueries({ queryKey: ['receivingStockTools'] });
        queryClient.invalidateQueries({ queryKey: ['suppliesMasterDataForStockList'] }); // Invalidate main stock list
        setSelectedItem(null);
    }
    
    const isLoading = isLoadingSupplies || isLoadingTools || isLoadingNeededSupplies;

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Estoque de Recebimento</CardTitle>
                    <CardDescription>
                        Itens recebidos via Ordem de Compra que aguardam para serem guardados no estoque.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-16">Foto</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Código/Lote</TableHead>
                                <TableHead>Descrição</TableHead>
                                <TableHead>Data Recebimento</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading && <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin"/></TableCell></TableRow>}
                            {!isLoading && allReceivingItems.length === 0 && <TableRow><TableCell colSpan={6} className="h-24 text-center">A área de recebimento está vazia.</TableCell></TableRow>}
                            {!isLoading && allReceivingItems.map(item => (
                                <TableRow key={`${item.itemType}-${item.docId}`}>
                                     <TableCell>
                                      <Image
                                        src={item.imageUrl || "https://picsum.photos/seed/default/64/64"}
                                        alt={item.descricao || "Item"}
                                        width={48}
                                        height={48}
                                        className="aspect-square rounded-md object-cover"
                                      />
                                   </TableCell>
                                    <TableCell><Badge variant={item.itemType === 'supply' ? 'secondary' : 'default'}>{item.itemType === 'supply' ? 'Suprimento' : 'Ferramenta'}</Badge></TableCell>
                                    <TableCell className="font-mono">{item.codigo || item.loteInterno}</TableCell>
                                    <TableCell>{item.descricao || 'N/A'}</TableCell>
                                    <TableCell>{item.dataEntrada ? format(new Date(item.dataEntrada), 'dd/MM/yyyy HH:mm') : 'N/A'}</TableCell>
                                    <TableCell className="text-right">
                                        <Button size="sm" onClick={() => setSelectedItem(item)}>
                                            <PackageCheck className="mr-2 h-4 w-4"/> Guardar no Estoque
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <StoreItemDialog
                isOpen={!!selectedItem}
                onClose={() => setSelectedItem(null)}
                item={selectedItem}
                onSuccess={handleSuccess}
            />
        </>
    );
}
