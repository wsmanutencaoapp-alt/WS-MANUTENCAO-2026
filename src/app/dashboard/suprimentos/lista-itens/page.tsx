
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
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
import { Loader2, PlusCircle, Search, LogIn, LogOut } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import SupplyMovementDialog from '@/components/SupplyMovementDialog';
import { format } from 'date-fns';


type StockItemWithDetails = WithDocId<SupplyStock> & {
    itemDescricao?: string;
    itemImageUrl?: string;
};


const SuprimentosPage = () => {
  const firestore = useFirestore();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    type: 'entrada' | 'saida';
    supply: WithDocId<Supply> | null;
  }>({ isOpen: false, type: 'entrada', supply: null });

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

  const handleOpenDialog = (type: 'entrada' | 'saida') => {
    setDialogState({ isOpen: true, type, supply: null });
  };
  
  const handleDialogSuccess = () => {
      queryClient.invalidateQueries({ queryKey: stockQueryKey });
      queryClient.invalidateQueries({ queryKey: suppliesQueryKey });
      setDialogState({ isOpen: false, type: 'entrada', supply: null });
  };
  
  const isLoading = isLoadingStock || isLoadingSupplies;

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inventário de Lotes de Suprimentos</h1>
        <div className="flex gap-2">
            <Button onClick={() => handleOpenDialog('entrada')}>
                <LogIn className="mr-2 h-4 w-4"/>
                Registrar Entrada
            </Button>
            <Button onClick={() => handleOpenDialog('saida')}>
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
                <TableHead>Item (Código)</TableHead>
                <TableHead>Lote Interno</TableHead>
                <TableHead>Lote Fornecedor</TableHead>
                <TableHead>Quantidade</TableHead>
                <TableHead>Localização</TableHead>
                <TableHead>Data de Entrada</TableHead>
                <TableHead>Validade</TableHead>
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
                    <div className="font-medium">{item.itemDescricao}</div>
                    <div className="text-sm text-muted-foreground">{item.supplyCodigo}</div>
                  </TableCell>
                  <TableCell className="font-mono">{item.loteInterno}</TableCell>
                  <TableCell className="font-mono">{item.loteFornecedor || 'N/A'}</TableCell>
                  <TableCell className="font-bold">{item.quantidade.toLocaleString()}</TableCell>
                  <TableCell>{item.localizacao}</TableCell>
                  <TableCell>{format(new Date(item.dataEntrada), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>{item.dataValidade ? format(new Date(item.dataValidade), 'dd/MM/yyyy') : 'N/A'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {dialogState.isOpen && (
          <SupplyMovementDialog
            isOpen={dialogState.isOpen}
            type={dialogState.type}
            supply={dialogState.supply}
            onClose={() => setDialogState(prev => ({...prev, isOpen: false}))}
            onSuccess={handleDialogSuccess}
          />
      )}
    </div>
  );
};

export default SuprimentosPage;

    