'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, collectionGroup, getDocs, documentId, doc, updateDoc, writeBatch } from 'firebase/firestore';
import type { SupplyStock, Tool, Address, Supply } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, Search, MapPin, Check, ChevronsUpDown, AlertTriangle, Save, ScanSearch } from 'lucide-react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type InventoryItem = {
    id: string;
    type: 'tool' | 'supply';
    supplyId?: string;
    masterInfo: Partial<Supply | Tool>;
    systemQty: number;
    countedQty: number;
    lote?: string;
    localizacao: string;
    status: string;
};

export default function InventarioSuprimentosPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
    const [isAddressPopoverOpen, setIsAddressPopoverOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // Fetch all addresses for the selector
    const addressesQuery = useMemoFirebase(() => (
        firestore ? query(collection(firestore, 'addresses'), where('setor', '==', '02')) : null
    ), [firestore]);
    const { data: addresses, isLoading: isLoadingAddresses } = useCollection<WithDocId<Address>>(addressesQuery, { queryKey: ['addresses_for_inventory'] });

    // 1. Tools Query (Standard query - no manual index needed)
    const toolsQuery = useMemoFirebase(() => 
        (firestore && selectedAddress) ? query(collection(firestore, 'tools'), where('enderecamento', '==', selectedAddress)) : null
    , [firestore, selectedAddress]);
    const { data: tools, isLoading: isLoadingTools } = useCollection<Tool>(toolsQuery);

    // 2. Supply Stock Query (CollectionGroup - no filter to avoid index)
    const allStockQuery = useMemoFirebase(() => firestore ? collectionGroup(firestore, 'stock') : null, [firestore]);
    const { data: allStock, isLoading: isLoadingStock } = useCollection<SupplyStock>(allStockQuery, {
        queryKey: ['allStockForInventory']
    });

    // 3. Filter and process data when tools or stock change
    useEffect(() => {
        if (!firestore || !selectedAddress || isLoadingTools || isLoadingStock) return;

        const loadInventoryData = async () => {
            setIsProcessing(true);
            try {
                // Tools in address
                const toolsItems: InventoryItem[] = (tools || []).map(t => ({
                    id: t.docId,
                    type: 'tool',
                    masterInfo: t,
                    systemQty: 1,
                    countedQty: 1,
                    localizacao: selectedAddress,
                    status: t.status
                }));

                // Stock items in address (filtered client-side)
                const stockInAddress = (allStock || []).filter(s => s.localizacao === selectedAddress);
                
                const supplyIds = [...new Set(stockInAddress.map(s => s.path.split('/')[1]))];
                
                let supplyMap = new Map<string, Supply>();
                if (supplyIds.length > 0) {
                    const suppliesQuery = query(collection(firestore, 'supplies'), where(documentId(), 'in', supplyIds));
                    const suppliesSnapshot = await getDocs(suppliesQuery);
                    suppliesSnapshot.forEach(d => supplyMap.set(d.id, d.data() as Supply));
                }

                const suppliesItems: InventoryItem[] = stockInAddress.map(stock => {
                    const supplyId = stock.path.split('/')[1];
                    const master = supplyMap.get(supplyId);
                    return {
                        id: stock.docId,
                        supplyId: supplyId,
                        type: 'supply',
                        masterInfo: master || {},
                        systemQty: stock.quantidade,
                        countedQty: stock.quantidade,
                        lote: stock.loteInterno,
                        localizacao: selectedAddress,
                        status: stock.status
                    };
                });

                setInventoryItems([...toolsItems, ...suppliesItems]);
            } catch (error: any) {
                console.error("Erro ao carregar dados do inventário:", error);
                toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os itens.' });
            } finally {
                setIsProcessing(false);
            }
        };

        loadInventoryData();
    }, [firestore, selectedAddress, tools, allStock, isLoadingTools, isLoadingStock, toast]);

    const handleCountChange = (id: string, value: string) => {
        const numValue = parseInt(value, 10);
        setInventoryItems(prev => prev.map(item => 
            item.id === id ? { ...item, countedQty: isNaN(numValue) ? 0 : numValue } : item
        ));
    };

    const handleSaveInventory = async () => {
        if (!firestore) return;
        setIsSaving(true);
        const batch = writeBatch(firestore);

        try {
            inventoryItems.forEach(item => {
                if (item.countedQty !== item.systemQty) {
                    if (item.type === 'supply' && item.supplyId) {
                        const stockRef = doc(firestore, 'supplies', item.supplyId, 'stock', item.id);
                        batch.update(stockRef, { quantidade: item.countedQty });
                    }
                }
            });

            await batch.commit();
            toast({ title: 'Sucesso!', description: 'Contagem de inventário salva e estoque atualizado.' });
            setInventoryItems([]);
            setSelectedAddress(null);
        } catch (error: any) {
            console.error("Erro ao salvar inventário:", error);
            toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao atualizar o estoque.' });
        } finally {
            setIsSaving(false);
        }
    };

    const isLoading = isLoadingTools || isLoadingStock || isProcessing;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <ScanSearch className="text-primary" />
                    Inventário e Contagem de Estoque
                </h1>
                <p className="text-muted-foreground">Selecione um endereço para iniciar a conferência física dos itens.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle>Localização</CardTitle>
                        <CardDescription>Bipe ou selecione o endereço.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Endereço do Setor 02</Label>
                            <Popover open={isAddressPopoverOpen} onOpenChange={setIsAddressPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-between font-normal" disabled={isLoadingAddresses}>
                                        {selectedAddress || "Selecione..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Buscar endereço..." />
                                        <CommandList>
                                            <CommandEmpty>Endereço não encontrado.</CommandEmpty>
                                            <CommandGroup>
                                                {addresses?.map((addr) => (
                                                    <CommandItem
                                                        key={addr.docId}
                                                        value={addr.codigoCompleto}
                                                        onSelect={() => {
                                                            setSelectedAddress(addr.codigoCompleto);
                                                            setIsAddressPopoverOpen(false);
                                                        }}
                                                    >
                                                        <Check className={cn("mr-2 h-4 w-4", selectedAddress === addr.codigoCompleto ? "opacity-100" : "opacity-0")} />
                                                        {addr.codigoCompleto}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-3">
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle>Itens na Localização</CardTitle>
                                <CardDescription>{selectedAddress ? `Endereço: ${selectedAddress}` : 'Nenhum endereço selecionado.'}</CardDescription>
                            </div>
                            {selectedAddress && (
                                <Badge variant="outline" className="text-lg px-4 py-1">
                                    {inventoryItems.length} Itens
                                </Badge>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center h-64 gap-4">
                                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                                <p className="text-muted-foreground animate-pulse">Varrendo prateleiras...</p>
                            </div>
                        ) : inventoryItems.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg bg-muted/10 text-muted-foreground">
                                <MapPin className="h-12 w-12 mb-4 opacity-20" />
                                <p>Selecione um endereço para listar os itens.</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Item</TableHead>
                                        <TableHead>Identificação</TableHead>
                                        <TableHead className="text-center">Sistema</TableHead>
                                        <TableHead className="w-32 text-center">Contado</TableHead>
                                        <TableHead className="text-center">Divergência</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {inventoryItems.map((item) => {
                                        const divergence = item.countedQty - item.systemQty;
                                        return (
                                            <TableRow key={`${item.type}-${item.id}`} className={cn(divergence !== 0 && "bg-orange-50 dark:bg-orange-900/10")}>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <Image 
                                                            src={(item.masterInfo as any).imageUrl || "https://picsum.photos/seed/default/64/64"} 
                                                            alt="item" width={40} height={40} className="rounded-md object-cover border" 
                                                        />
                                                        <div className="text-sm">
                                                            <p className="font-bold">{(item.masterInfo as any).descricao || 'N/A'}</p>
                                                            <Badge variant="outline" className="text-[10px] uppercase">{item.type}</Badge>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-mono text-xs">
                                                    <p>{(item.masterInfo as any).codigo || 'N/A'}</p>
                                                    {item.lote && <p className="text-muted-foreground">LOTE: {item.lote}</p>}
                                                </TableCell>
                                                <TableCell className="text-center font-bold">{item.systemQty}</TableCell>
                                                <TableCell>
                                                    <Input 
                                                        type="number" 
                                                        value={item.countedQty} 
                                                        onChange={(e) => handleCountChange(item.id, e.target.value)}
                                                        className="text-center h-8 font-bold"
                                                    />
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {divergence === 0 ? (
                                                        <Check className="h-5 w-5 text-green-500 mx-auto" />
                                                    ) : (
                                                        <span className={cn("font-bold flex items-center justify-center gap-1", divergence > 0 ? "text-blue-600" : "text-destructive")}>
                                                            <AlertTriangle className="h-4 w-4" />
                                                            {divergence > 0 ? `+${divergence}` : divergence}
                                                        </span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                    {inventoryItems.length > 0 && (
                        <CardFooter className="justify-end border-t pt-6">
                            <Button onClick={handleSaveInventory} disabled={isSaving}>
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Atualizar Estoque / Finalizar Contagem
                            </Button>
                        </CardFooter>
                    )}
                </Card>
            </div>
        </div>
    );
}
