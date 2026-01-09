'use client';

import { useState, useMemo, useEffect, Fragment } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, getDocs } from 'firebase/firestore';
import type { Supply, SupplyStock } from '@/lib/types';
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
import { Loader2, PlusCircle, Search, LogIn, LogOut, Edit, PackageSearch, ChevronDown, ChevronRight } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import SupplyMovementDialog from '@/components/SupplyMovementDialog';
import { format, parseISO } from 'date-fns';
import Image from 'next/image';
import SupplyFormDialog from '@/components/SupplyFormDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';


type EnrichedStockItem = WithDocId<SupplyStock> & {
    supplyInfo: WithDocId<Supply>;
};


const SuprimentosPage = () => {
  const firestore = useFirestore();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [movementDialogState, setMovementDialogState] = useState<{
    isOpen: boolean;
    type: 'entrada' | 'saida';
    supply: WithDocId<Supply> | null;
  }>({ isOpen: false, type: 'entrada', supply: null });
  
  const [formDialogState, setFormDialogState] = useState<{
      isOpen: boolean;
      supply: WithDocId<Supply> | null;
  }>({ isOpen: false, supply: null });
  
  const [imageToView, setImageToView] = useState<{ src: string, alt: string } | null>(null);
  
  // 1. Fetch all master supply data 
  const suppliesQueryKey = ['suppliesMasterDataForStockList'];
  const suppliesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'supplies'), orderBy('codigo')) : null),
    [firestore]
  );
  const { data: supplies, isLoading: isLoadingSupplies } = useCollection<WithDocId<Supply>>(suppliesQuery, {
    queryKey: suppliesQueryKey
  });

  const [enrichedStock, setEnrichedStock] = useState<EnrichedStockItem[]>([]);
  const [isStockLoading, setIsStockLoading] = useState(true);

  // 2. Fetch all stock items from all supplies and enrich them
  useEffect(() => {
    if (!supplies || !firestore) return;

    const fetchAllStock = async () => {
        setIsStockLoading(true);
        const allStockItems: EnrichedStockItem[] = [];
        const supplyMap = new Map(supplies.map(s => [s.docId, s]));

        for (const supply of supplies) {
            const stockCollectionRef = collection(firestore, 'supplies', supply.docId, 'stock');
            const stockSnapshot = await getDocs(stockCollectionRef);
            
            stockSnapshot.forEach(doc => {
                 const stockData = { ...doc.data() as SupplyStock, docId: doc.id };
                 const supplyInfo = supplyMap.get(supply.docId);
                 if (supplyInfo) {
                     allStockItems.push({
                         ...stockData,
                         supplyInfo: supplyInfo
                     });
                 }
            });
        }
        setEnrichedStock(allStockItems);
        setIsStockLoading(false);
    };

    fetchAllStock();
  }, [supplies, firestore]);
  

  const filteredStock = useMemo(() => {
    if (!enrichedStock) return [];
    if (!searchTerm) return enrichedStock;

    const lowercasedTerm = searchTerm.toLowerCase();
    return enrichedStock.filter(item => 
      (item.supplyInfo.descricao && item.supplyInfo.descricao.toLowerCase().includes(lowercasedTerm)) ||
      (item.supplyInfo.codigo && item.supplyInfo.codigo.toLowerCase().includes(lowercasedTerm)) ||
      (item.loteInterno && item.loteInterno.toLowerCase().includes(lowercasedTerm)) ||
      (item.localizacao && item.localizacao.toLowerCase().includes(lowercasedTerm))
    );
  }, [enrichedStock, searchTerm]);
  
  const handleGoToCadastro = () => {
    router.push('/dashboard/cadastros/suprimentos');
  }

  const handleOpenMovementDialog = (type: 'entrada' | 'saida', supply: WithDocId<Supply> | null) => {
    setMovementDialogState({ isOpen: true, type, supply });
  };

  const handleOpenFormDialog = (supply: WithDocId<Supply>) => {
    setFormDialogState({ isOpen: true, supply: supply });
  };
  
  const handleDialogSuccess = () => {
      // Re-trigger the stock fetching
      queryClient.invalidateQueries({ queryKey: suppliesQueryKey });
      setMovementDialogState({ isOpen: false, type: 'entrada', supply: null });
      setFormDialogState({ isOpen: false, supply: null });
  };

  const isLoading = isLoadingSupplies || isStockLoading;

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inventário de Suprimentos por Lote</h1>
        <div className="flex gap-2">
            <Button onClick={() => handleOpenMovementDialog('entrada', null)}>
                <LogIn className="mr-2 h-4 w-4"/>
                Registrar Entrada
            </Button>
            <Button onClick={() => handleOpenMovementDialog('saida', null)}>
                <LogOut className="mr-2 h-4 w-4"/>
                Registrar Saída
            </Button>
            <Button variant="outline" onClick={handleGoToCadastro}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Gerenciar Itens Mestre
            </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Visão de Estoque por Lote</CardTitle>
          <CardDescription>
            Visualize cada lote de item individualmente no estoque.
          </CardDescription>
          <div className="relative pt-4">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
                placeholder="Pesquisar por item, código, lote ou localização..."
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
                <TableHead className="w-16">Foto</TableHead>
                <TableHead>Item (Código)</TableHead>
                <TableHead>Lote Interno</TableHead>
                <TableHead>Localização</TableHead>
                <TableHead>Quantidade</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={7} className="text-center h-24"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow>
              )}
              {!isLoading && filteredStock.length === 0 && (
                <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                        <PackageSearch className="mx-auto h-8 w-8 text-muted-foreground mb-2"/>
                        <p className="text-muted-foreground">Nenhum item em estoque.</p>
                    </TableCell>
                </TableRow>
              )}
              {!isLoading && filteredStock.map(item => {
                  const { supplyInfo } = item;
                  return (
                    <TableRow key={item.docId}>
                        <TableCell>
                        <button onClick={() => setImageToView({ src: supplyInfo.imageUrl || 'https://picsum.photos/seed/supply/48/48', alt: supplyInfo.descricao || 'Item sem imagem' })}>
                            <Image
                            alt={supplyInfo.descricao || ''}
                            className="aspect-square rounded-md object-cover cursor-pointer"
                            height="48"
                            src={supplyInfo.imageUrl || 'https://picsum.photos/seed/supply/48/48'}
                            width="48"
                            />
                        </button>
                        </TableCell>
                    <TableCell>
                        <div className="font-medium">{supplyInfo.descricao}</div>
                        <div className="text-sm text-muted-foreground">{supplyInfo.codigo}</div>
                    </TableCell>
                    <TableCell className="font-mono">{item.loteInterno}</TableCell>
                    <TableCell>{item.localizacao}</TableCell>
                    <TableCell className="font-bold">{item.quantidade.toLocaleString()}</TableCell>
                    <TableCell>{item.dataValidade ? format(parseISO(item.dataValidade), 'dd/MM/yyyy') : 'N/A'}</TableCell>
                    <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" title="Registrar Saída deste Lote" onClick={() => handleOpenMovementDialog('saida', supplyInfo)}>
                            <LogOut className="h-4 w-4 text-orange-600"/>
                        </Button>
                        <Button variant="ghost" size="icon" title="Editar Item Mestre" onClick={() => handleOpenFormDialog(supplyInfo)}>
                            <Edit className="h-4 w-4"/>
                        </Button>
                    </TableCell>
                    </TableRow>
                  );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {movementDialogState.isOpen && (
          <SupplyMovementDialog
            isOpen={movementDialogState.isOpen}
            type={movementDialogState.type}
            supply={movementDialogState.supply}
            onClose={() => setMovementDialogState(prev => ({...prev, isOpen: false}))}
            onSuccess={handleDialogSuccess}
          />
      )}
      
      {formDialogState.isOpen && (
          <SupplyFormDialog
            isOpen={formDialogState.isOpen}
            onClose={() => setFormDialogState(prev => ({...prev, isOpen: false}))}
            onSuccess={handleDialogSuccess}
            supply={formDialogState.supply}
          />
      )}

      {imageToView && (
        <Dialog open={!!imageToView} onOpenChange={() => setImageToView(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{imageToView.alt}</DialogTitle>
            </DialogHeader>
            <div className="relative w-full aspect-square">
              <Image 
                src={imageToView.src}
                alt={imageToView.alt}
                fill
                className="object-contain rounded-md"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default SuprimentosPage;
