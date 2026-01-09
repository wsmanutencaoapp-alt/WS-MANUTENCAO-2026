'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
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
import { Loader2, PlusCircle, Search, LogIn, LogOut, Edit } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import SupplyMovementDialog from '@/components/SupplyMovementDialog';
import { format } from 'date-fns';
import Image from 'next/image';
import SupplyFormDialog from '@/components/SupplyFormDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';


type StockItemWithDetails = WithDocId<SupplyStock> & {
    itemDescricao?: string;
    itemImageUrl?: string;
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


  // 1. Fetch all master supply data to map details to stock items
  const suppliesQueryKey = ['suppliesMasterDataForStockList'];
  const suppliesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'supplies')) : null),
    [firestore]
  );
  const { data: supplies, isLoading: isLoadingSupplies } = useCollection<WithDocId<Supply>>(suppliesQuery, {
    queryKey: suppliesQueryKey
  });

  // 2. Fetch all stock items
  const stockQueryKey = ['allSupplyStockList'];
  const stockQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'supply_stock'), orderBy('dataEntrada', 'desc')) : null),
    [firestore]
  );
  const { data: stockItems, isLoading: isLoadingStock, error } = useCollection<WithDocId<SupplyStock>>(stockQuery, {
      queryKey: stockQueryKey
  });

  // 3. Combine the data
  const combinedStockList = useMemo((): StockItemWithDetails[] => {
    if (!stockItems || !supplies) return [];
    
    const suppliesMap = new Map(supplies.map(s => [s.docId, s]));

    return stockItems.map(stockItem => {
        const masterItem = suppliesMap.get(stockItem.supplyId);
        return {
            ...stockItem,
            itemDescricao: masterItem?.descricao || 'Descrição não encontrada',
            itemImageUrl: masterItem?.imageUrl,
        }
    });

  }, [stockItems, supplies]);

  const filteredStockList = useMemo(() => {
    if (!combinedStockList) return [];
    if (!searchTerm) return combinedStockList;

    const lowercasedTerm = searchTerm.toLowerCase();
    return combinedStockList.filter(item => 
      (item.itemDescricao && item.itemDescricao.toLowerCase().includes(lowercasedTerm)) ||
      (item.supplyCodigo && item.supplyCodigo.toLowerCase().includes(lowercasedTerm)) ||
      (item.loteInterno && item.loteInterno.toLowerCase().includes(lowercasedTerm)) ||
      (item.loteFornecedor && item.loteFornecedor.toLowerCase().includes(lowercasedTerm))
    );
  }, [combinedStockList, searchTerm]);
  
  const handleGoToCadastro = () => {
    router.push('/dashboard/cadastros/suprimentos');
  }

  const handleOpenMovementDialog = (type: 'entrada' | 'saida', supplyId: string) => {
    const supply = supplies?.find(s => s.docId === supplyId);
    if(supply) {
        setMovementDialogState({ isOpen: true, type, supply });
    }
  };

  const handleOpenFormDialog = (supplyId: string) => {
    const supply = supplies?.find(s => s.docId === supplyId);
    if (supply) {
        setFormDialogState({ isOpen: true, supply: supply });
    }
  };
  
  const handleDialogSuccess = () => {
      queryClient.invalidateQueries({ queryKey: stockQueryKey });
      queryClient.invalidateQueries({ queryKey: suppliesQueryKey });
      setMovementDialogState({ isOpen: false, type: 'entrada', supply: null });
      setFormDialogState({ isOpen: false, supply: null });
  };
  
  const isLoading = isLoadingStock || isLoadingSupplies;

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inventário de Lotes de Suprimentos</h1>
        <div className="flex gap-2">
            <Button onClick={() => setMovementDialogState({ isOpen: true, type: 'entrada', supply: null })}>
                <LogIn className="mr-2 h-4 w-4"/>
                Registrar Entrada
            </Button>
            <Button onClick={() => setMovementDialogState({ isOpen: true, type: 'saida', supply: null })}>
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
          <CardTitle>Lotes em Estoque</CardTitle>
          <CardDescription>
            Gerencie e visualize todos os lotes individuais de suprimentos em estoque.
          </CardDescription>
          <div className="relative pt-4">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
                placeholder="Pesquisar por item, código, lote..."
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
                <TableHead>Quantidade</TableHead>
                <TableHead>Localização</TableHead>
                <TableHead>Data de Entrada</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={7} className="text-center h-24"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow>
              )}
              {error && (
                <TableRow><TableCell colSpan={7} className="text-center text-destructive h-24">Erro ao carregar dados.</TableCell></TableRow>
              )}
              {!isLoading && filteredStockList.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center h-24">Nenhum lote em estoque.</TableCell></TableRow>
              )}
              {!isLoading && filteredStockList.map(item => (
                <TableRow key={item.docId}>
                    <TableCell>
                      <button onClick={() => setImageToView({ src: item.itemImageUrl || 'https://picsum.photos/seed/supply/48/48', alt: item.itemDescricao || 'Item sem imagem' })}>
                        <Image
                          alt={item.itemDescricao || ''}
                          className="aspect-square rounded-md object-cover cursor-pointer"
                          height="48"
                          src={item.itemImageUrl || 'https://picsum.photos/seed/supply/48/48'}
                          width="48"
                        />
                      </button>
                    </TableCell>
                  <TableCell>
                    <div className="font-medium">{item.itemDescricao}</div>
                    <div className="text-sm text-muted-foreground">{item.supplyCodigo}</div>
                  </TableCell>
                  <TableCell className="font-mono">{item.loteInterno}</TableCell>
                  <TableCell className="font-bold">{item.quantidade.toLocaleString()}</TableCell>
                  <TableCell>{item.localizacao}</TableCell>
                  <TableCell>{format(new Date(item.dataEntrada), 'dd/MM/yyyy')}</TableCell>
                  <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" title="Registrar Entrada" onClick={() => handleOpenMovementDialog('entrada', item.supplyId)}>
                          <LogIn className="h-4 w-4 text-green-600"/>
                      </Button>
                      <Button variant="ghost" size="icon" title="Registrar Saída" onClick={() => handleOpenMovementDialog('saida', item.supplyId)}>
                          <LogOut className="h-4 w-4 text-orange-600"/>
                      </Button>
                      <Button variant="ghost" size="icon" title="Editar Item Mestre" onClick={() => handleOpenFormDialog(item.supplyId)}>
                          <Edit className="h-4 w-4"/>
                      </Button>
                  </TableCell>
                </TableRow>
              ))}
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
