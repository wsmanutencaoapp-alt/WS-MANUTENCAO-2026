'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, collectionGroup, getDocs, documentId } from 'firebase/firestore';
import { useSearchParams } from 'next/navigation';
import type { Tool, SupplyStock, Supply } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, Wrench, Search, MapPin, Box, AlertTriangle } from 'lucide-react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';

type InventoryItem = {
    id: string;
    type: 'tool' | 'supply';
    descricao: string;
    codigo: string;
    status: string;
    quantidade?: number;
    unidade?: string;
    imageUrl?: string;
    lote?: string;
};

function ConsultaEndereçoContent() {
    const searchParams = useSearchParams();
    const addressCode = searchParams.get('code');
    const firestore = useFirestore();
    const { toast } = useToast();

    const [enrichedItems, setEnrichedItems] = useState<InventoryItem[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);

    // 1. Fetch Tools directly (automatic index handles this)
    const toolsQuery = useMemoFirebase(() => 
        (firestore && addressCode) ? query(collection(firestore, 'tools'), where('enderecamento', '==', addressCode)) : null
    , [firestore, addressCode]);
    const { data: tools, isLoading: isLoadingTools } = useCollection<Tool>(toolsQuery);

    // 2. Fetch ALL Supply Stock (avoiding index requirement for collectionGroup + where)
    const allStockQuery = useMemoFirebase(() => firestore ? collectionGroup(firestore, 'stock') : null, [firestore]);
    const { data: allStock, isLoading: isLoadingStock } = useCollection<SupplyStock>(allStockQuery, {
        queryKey: ['allStockForAddressSearch']
    });

    // 3. Filter and Enrich data
    useEffect(() => {
        if (!firestore || !addressCode || isLoadingTools || isLoadingStock) return;

        const enrichData = async () => {
            setIsProcessing(true);
            try {
                // Filter tools (they are already filtered by query, but we map them)
                const toolsItems: InventoryItem[] = (tools || []).map(t => ({
                    id: t.docId,
                    type: 'tool',
                    descricao: t.descricao,
                    codigo: t.codigo,
                    status: t.status,
                    imageUrl: t.imageUrl,
                }));

                // Filter stock items client-side
                const stockInAddress = (allStock || []).filter(s => s.localizacao === addressCode);
                
                const supplyIds = [...new Set(stockInAddress.map(s => s.path.split('/')[1]))];
                
                let supplyMap = new Map<string, Supply>();
                if (supplyIds.length > 0) {
                    const suppliesQuery = query(collection(firestore, 'supplies'), where(documentId(), 'in', supplyIds));
                    const suppliesSnapshot = await getDocs(suppliesQuery);
                    suppliesSnapshot.forEach(doc => supplyMap.set(doc.id, doc.data() as Supply));
                }

                const suppliesItems: InventoryItem[] = stockInAddress.map(stock => {
                    const supplyId = stock.path.split('/')[1];
                    const master = supplyMap.get(supplyId);
                    return {
                        id: stock.docId,
                        type: 'supply',
                        descricao: master?.descricao || 'Suprimento Desconhecido',
                        codigo: master?.codigo || 'N/A',
                        status: stock.status,
                        quantidade: stock.quantidade,
                        unidade: master?.unidadeMedida,
                        imageUrl: master?.imageUrl,
                        lote: stock.loteInterno
                    };
                });

                setEnrichedItems([...toolsItems, ...suppliesItems]);
            } catch (err: any) {
                console.error("Erro ao enriquecer dados do endereço:", err);
                toast({ variant: 'destructive', title: 'Erro de Dados', description: 'Não foi possível carregar os detalhes dos itens.' });
            } finally {
                setIsProcessing(false);
            }
        };

        enrichData();
    }, [firestore, addressCode, tools, allStock, isLoadingTools, isLoadingStock, toast]);

    if (!addressCode) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Card className="max-w-md w-full">
                    <CardContent className="pt-6 text-center">
                        <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <h2 className="text-xl font-bold mb-2">Nenhum endereço fornecido</h2>
                        <p className="text-muted-foreground text-sm">Escaneie um QR Code de endereço válido para ver os itens localizados nele.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const isLoading = isLoadingTools || isLoadingStock || isProcessing;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <MapPin className="text-primary" />
                    Consulta de Localização
                </h1>
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Badge variant="outline" className="text-lg font-mono px-3 py-1 bg-muted/50 border-primary/20">
                        {addressCode}
                    </Badge>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Conteúdo do Endereço</CardTitle>
                    <CardDescription>
                        Todos os itens registrados fisicamente nesta posição.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-48 gap-2">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Consultando banco de dados...</p>
                        </div>
                    ) : enrichedItems.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/10">
                            <Box className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                            <p className="text-muted-foreground font-medium">Este endereço está vazio no sistema.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-16">Foto</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Item / Identificação</TableHead>
                                    <TableHead>Qtd / Lote</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {enrichedItems.map((item) => (
                                    <TableRow key={`${item.type}-${item.id}`}>
                                        <TableCell>
                                            <Image 
                                                src={item.imageUrl || "https://picsum.photos/seed/default/64/64"}
                                                alt={item.descricao}
                                                width={48}
                                                height={48}
                                                className="aspect-square rounded-md object-cover border"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            {item.type === 'tool' ? (
                                                <Badge variant="default" className="gap-1">
                                                    <Wrench className="h-3 w-3" /> Ferramenta
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary" className="gap-1">
                                                    <Package className="h-3 w-3" /> Suprimento
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <p className="font-bold">{item.descricao}</p>
                                            <p className="text-xs text-muted-foreground font-mono">{item.codigo}</p>
                                        </TableCell>
                                        <TableCell>
                                            {item.type === 'supply' ? (
                                                <div className="space-y-1">
                                                    <p className="font-bold text-base">{item.quantidade} {item.unidade}</p>
                                                    <p className="text-[10px] font-mono uppercase text-muted-foreground">Lote: {item.lote}</p>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground">1 un</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={item.status === 'Disponível' ? 'success' : 'default'}>
                                                {item.status}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

export default function ConsultaEndereçoPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin"/></div>}>
            <ConsultaEndereçoContent />
        </Suspense>
    );
}
