
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where, getDocs } from 'firebase/firestore';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, PlusCircle, Search, LogIn, LogOut } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import SupplyMovementDialog from '@/components/SupplyMovementDialog';
import StockDetailsDialog from '@/components/StockDetailsDialog'; // Import new component

const SuprimentosPage = () => {
  const firestore = useFirestore();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [imageToView, setImageToView] = useState<{ src: string, alt: string } | null>(null);
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    type: 'entrada' | 'saida';
    supply: WithDocId<Supply> | null;
  }>({ isOpen: false, type: 'entrada', supply: null });
  const [selectedSupplyForDetails, setSelectedSupplyForDetails] = useState<WithDocId<Supply> | null>(null);


  const suppliesQueryKey = ['suppliesMasterDataForListing'];
  const suppliesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'supplies'), orderBy('codigo')) : null),
    [firestore]
  );
  
  const { data: supplies, isLoading, error } = useCollection<WithDocId<Supply>>(suppliesQuery, {
    queryKey: suppliesQueryKey
  });

  const { data: stockData, isLoading: isLoadingStock } = useQuery({
    queryKey: ['allSupplyStock'],
    queryFn: async () => {
        if (!firestore) return new Map<string, number>();
        const stockQuery = query(collection(firestore, 'supply_stock'));
        const snapshot = await getDocs(stockQuery);
        const stockMap = new Map<string, number>();
        snapshot.forEach(doc => {
            const stock = doc.data() as SupplyStock;
            const currentQty = stockMap.get(stock.supplyId) || 0;
            stockMap.set(stock.supplyId, currentQty + stock.quantidade);
        });
        return stockMap;
    },
    enabled: !!firestore,
    staleTime: 60000, // Refetch every minute
  });

  const suppliesWithStock = useMemo(() => {
    if (!supplies || !stockData) return [];
    return supplies.map(supply => ({
      ...supply,
      saldoAtual: stockData.get(supply.docId) || 0,
    }));
  }, [supplies, stockData]);


  const filteredSupplies = useMemo(() => {
    if (!suppliesWithStock) return [];
    if (!searchTerm) return suppliesWithStock;

    const lowercasedTerm = searchTerm.toLowerCase();
    return suppliesWithStock.filter(supply => 
      supply.descricao.toLowerCase().includes(lowercasedTerm) ||
      (supply.partNumber && supply.partNumber.toLowerCase().includes(lowercasedTerm)) ||
      supply.codigo.toLowerCase().includes(lowercasedTerm)
    );
  }, [suppliesWithStock, searchTerm]);
  
  const handleGoToCadastro = () => {
    router.push('/dashboard/cadastros/suprimentos');
  }

  const handleOpenDialog = (type: 'entrada' | 'saida', supply: WithDocId<Supply> | null = null) => {
    setDialogState({ isOpen: true, type, supply });
  };
  
  const handleDialogSuccess = () => {
      queryClient.invalidateQueries({ queryKey: suppliesQueryKey });
      queryClient.invalidateQueries({ queryKey: ['allSupplyStock'] });
      setDialogState({ isOpen: false, type: 'entrada', supply: null });
  };

  const openStockDetails = (supply: WithDocId<Supply>) => {
    setSelectedSupplyForDetails(supply);
  };


  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Visão Geral de Suprimentos</h1>
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
                Adicionar Item ao Cadastro
            </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inventário de Suprimentos</CardTitle>
          <CardDescription>
            Gerencie e visualize o saldo de todos os itens de suprimento.
          </CardDescription>
          <div className="relative pt-4">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
                placeholder="Pesquisar por código, P/N ou descrição..."
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
                <TableHead className="hidden w-[64px] sm:table-cell">Foto</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Part Number</TableHead>
                <TableHead>Saldo Atual</TableHead>
                <TableHead>U.M.</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(isLoading || isLoadingStock) && (
                <TableRow><TableCell colSpan={7} className="text-center h-24"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow>
              )}
              {error && (
                <TableRow><TableCell colSpan={7} className="text-center text-destructive h-24">Erro ao carregar dados.</TableCell></TableRow>
              )}
              {!isLoading && !isLoadingStock && filteredSupplies.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center h-24">Nenhum item encontrado.</TableCell></TableRow>
              )}
              {!isLoading && !isLoadingStock && filteredSupplies.map(item => (
                <TableRow key={item.docId}>
                   <TableCell className="hidden sm:table-cell">
                      <button onClick={() => setImageToView({ src: item.imageUrl || 'https://picsum.photos/seed/supply/48/48', alt: item.descricao })}>
                        <Image
                          alt={item.descricao}
                          className="aspect-square rounded-md object-cover cursor-pointer"
                          height="48"
                          src={item.imageUrl || 'https://picsum.photos/seed/supply/48/48'}
                          width="48"
                        />
                      </button>
                    </TableCell>
                  <TableCell className="font-mono">{item.codigo}</TableCell>
                  <TableCell className="font-medium">{item.descricao}</TableCell>
                  <TableCell>{item.partNumber || 'N/A'}</TableCell>
                  <TableCell>
                    <Button 
                      variant="link" 
                      className="font-bold p-0 h-auto"
                      onClick={() => openStockDetails(item)}
                      disabled={(item.saldoAtual || 0) === 0}
                    >
                      {(item.saldoAtual || 0).toLocaleString()}
                    </Button>
                  </TableCell>
                  <TableCell>{item.unidadeMedida}</TableCell>
                   <TableCell className="text-right space-x-1">
                      <Button variant="outline" size="icon" title="Registrar Entrada" onClick={() => handleOpenDialog('entrada', item)}>
                          <LogIn className="h-4 w-4"/>
                      </Button>
                      <Button variant="outline" size="icon" title="Registrar Saída" onClick={() => handleOpenDialog('saida', item)}>
                          <LogOut className="h-4 w-4"/>
                      </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
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

      {dialogState.isOpen && (
          <SupplyMovementDialog
            isOpen={dialogState.isOpen}
            type={dialogState.type}
            supply={dialogState.supply}
            onClose={() => setDialogState(prev => ({...prev, isOpen: false}))}
            onSuccess={handleDialogSuccess}
          />
      )}

      {selectedSupplyForDetails && (
        <StockDetailsDialog
          isOpen={!!selectedSupplyForDetails}
          onClose={() => setSelectedSupplyForDetails(null)}
          supply={selectedSupplyForDetails}
        />
      )}
    </div>
  );
};

export default SuprimentosPage;
