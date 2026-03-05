'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collectionGroup, query, where, doc, updateDoc, writeBatch, collection, getDocs } from 'firebase/firestore';
import type { SupplyStock, Tool, Address } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, PackageCheck, Search, Check, ChevronsUpDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from './ui/label';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Badge } from './ui/badge';
import Image from 'next/image';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

type ReceivingItem = (WithDocId<SupplyStock> | WithDocId<Tool>) & { 
    itemType: 'supply' | 'tool',
    descricao?: string,
    codigo?: string,
    loteInterno?: string,
    dataEntrada?: string,
    imageUrl?: string,
};

// Component to handle moving an item from receiving to final stock
const StoreItemDialog = ({
  item,
  isOpen,
  onClose,
  onSuccess
}: {
  item: ReceivingItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [finalLocation, setFinalLocation] = useState('');
    const [isAddressPopoverOpen, setIsAddressPopoverOpen] = useState(false);
    
    const addressesQuery = useMemoFirebase(() => {
        if (!firestore || !item) return null;
        const sector = item.itemType === 'supply' ? '02' : '01';
        return query(collection(firestore, 'addresses'), where('setor', '==', sector));
    }, [firestore, item]);

    const { data: addresses, isLoading: isLoadingAddresses } = useCollection<WithDocId<Address>>(addressesQuery, {
        queryKey: ['addressesForStoring', item?.itemType],
        enabled: isOpen && !!item,
    });

    useEffect(() => {
        if (item) {
            const defaultLocation = (item as any).localizacaoPadrao || '';
            setFinalLocation(defaultLocation);
        } else {
            setFinalLocation('');
        }
    }, [item]);

    const handleStoreItem = async () => {
        if (!firestore || !item || !finalLocation) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Localização final é obrigatória.' });
            return;
        }
        setIsSaving(true);
        try {
            const collectionPath = item.itemType === 'supply' ? `supplies/${(item as any).supplyId}/stock` : 'tools';
            const itemRef = doc(firestore, collectionPath, item.docId);

            await updateDoc(itemRef, {
                status: 'Disponível',
                localizacao: finalLocation
            });

            toast({ title: 'Sucesso!', description: 'Item guardado no estoque.' });
            onSuccess();
        } catch (err) {
            console.error("Erro ao guardar item:", err);
            toast({ variant: 'destructive', title: 'Erro na Operação', description: 'Não foi possível guardar o item.' });
        } finally {
            setIsSaving(false);
        }
    };
    
    if (!item) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Guardar Item no Estoque</DialogTitle>
                    <DialogDescription>
                        Defina a localização final para o item <span className='font-bold'>{(item as any).descricao || (item as any).loteInterno}</span>.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <p className="text-sm"><strong>Item:</strong> {item.descricao || item.itemType}</p>
                    <p className="text-sm font-mono"><strong>Lote/Código:</strong> {item.loteInterno || item.codigo}</p>
                     <div className="space-y-1.5">
                        <Label htmlFor="finalLocation">Localização Final <span className="text-destructive">*</span></Label>
                        <Popover open={isAddressPopoverOpen} onOpenChange={setIsAddressPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" className="w-full justify-between font-normal" disabled={isLoadingAddresses}>
                              {isLoadingAddresses ? <Loader2 className="h-4 w-4 animate-spin"/> : finalLocation || "Selecione um endereço..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                              <Command>
                                  <CommandInput placeholder="Pesquisar endereço..." />
                                  <CommandList>
                                      <CommandEmpty>Nenhum endereço disponível.</CommandEmpty>
                                      <CommandGroup>
                                          {addresses?.map((addr) => (
                                              <CommandItem key={addr.docId} value={addr.codigoCompleto} onSelect={(currentValue) => { setFinalLocation(currentValue === finalLocation ? '' : currentValue); setIsAddressPopoverOpen(false); }}>
                                                  <Check className={cn("mr-2 h-4 w-4", finalLocation === addr.codigoCompleto ? "opacity-100" : "opacity-0")} />
                                                  {addr.codigoCompleto}
                                              </CommandItem>
                                          ))}
                                      </CommandGroup>
                                  </CommandList>
                              </Command>
                          </PopoverContent>
                        </Popover>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
                    <Button onClick={handleStoreItem} disabled={isSaving || !finalLocation}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirmar e Guardar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


export default function ReceivingStockTable() {
    const firestore = useFirestore();
    const queryClient = useQueryClient();
    
    const [selectedItem, setSelectedItem] = useState<ReceivingItem | null>(null);

    const supplyStockQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collectionGroup(firestore, 'stock'), where('status', '==', 'Em Recebimento'));
    }, [firestore]);
    const { data: receivingSupplies, isLoading: isLoadingSupplies, error: suppliesError } = useCollection<WithDocId<SupplyStock>>(supplyStockQuery, {
        queryKey: ['receivingStockSupplies']
    });

    const toolsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'tools'), where('status', '==', 'Em Recebimento'));
    }, [firestore]);
    const { data: receivingTools, isLoading: isLoadingTools, error: toolsError } = useCollection<WithDocId<Tool>>(toolsQuery, {
        queryKey: ['receivingStockTools']
    });

    const [enrichedSupplies, setEnrichedSupplies] = useState<ReceivingItem[]>([]);
    useEffect(() => {
        if (!receivingSupplies || !firestore) {
            setEnrichedSupplies([]);
            return;
        }

        const enrich = async () => {
            if (receivingSupplies.length === 0) {
              setEnrichedSupplies([]);
              return;
            }
            const supplyIds = [...new Set(receivingSupplies.map(s => s.path.split('/')[1]))];
            if (supplyIds.length === 0) {
                setEnrichedSupplies([]);
                return;
            }

            const suppliesRef = collection(firestore, 'supplies');
            const q = query(suppliesRef, where('__name__', 'in', supplyIds));
            const supplyDocs = await getDocs(q);
            const supplyMap = new Map(supplyDocs.docs.map(d => [d.id, d.data() as Supply]));

            const enriched = receivingSupplies.map(stockItem => {
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
            setEnrichedSupplies(enriched);
        };
        
        enrich();
    }, [receivingSupplies, firestore]);
    
    const allReceivingItems: ReceivingItem[] = useMemo(() => {
        const toolsWithType: ReceivingItem[] = receivingTools?.map(t => ({...t, itemType: 'tool' as const})) || [];
        return [...enrichedSupplies, ...toolsWithType].sort((a,b) => {
            const dateA = new Date((a as any).dataEntrada || 0).getTime();
            const dateB = new Date((b as any).dataEntrada || 0).getTime();
            return dateB - dateA;
        });
    }, [enrichedSupplies, receivingTools]);
    
    const handleSuccess = () => {
        queryClient.invalidateQueries({ queryKey: ['receivingStockSupplies'] });
        queryClient.invalidateQueries({ queryKey: ['receivingStockTools'] });
        queryClient.invalidateQueries({ queryKey: ['suppliesMasterDataForStockList'] }); // Invalidate main stock list
        setSelectedItem(null);
    }
    
    const isLoading = isLoadingSupplies || isLoadingTools;

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
