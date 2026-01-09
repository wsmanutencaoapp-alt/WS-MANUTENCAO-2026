
'use client';

import { useState, useMemo, useEffect } from 'react';
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
import { Loader2, PlusCircle, Search, LogIn, LogOut, Edit, PackageSearch } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import SupplyMovementDialog from '@/components/SupplyMovementDialog';
import { format } from 'date-fns';
import Image from 'next/image';
import SupplyFormDialog from '@/components/SupplyFormDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';


type SupplyWithStock = WithDocId<Supply> & {
    stock: WithDocId<SupplyStock>[];
    totalStock: number;
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

  const [suppliesWithStock, setSuppliesWithStock] = useState<SupplyWithStock[]>([]);
  const [isStockLoading, setIsStockLoading] = useState(true);

  // 2. Fetch stock for each supply item
  useEffect(() => {
    if (!supplies || !firestore) return;

    const fetchAllStock = async () => {
        setIsStockLoading(true);
        const enrichedSupplies: SupplyWithStock[] = [];
        for (const supply of supplies) {
            const stockCollectionRef = collection(firestore, 'supplies', supply.docId, 'stock');
            const stockSnapshot = await getDocs(stockCollectionRef);
            const stockItems = stockSnapshot.docs.map(doc => ({ ...doc.data() as SupplyStock, docId: doc.id }));
            const totalStock = stockItems.reduce((acc, item) => acc + item.quantidade, 0);
            enrichedSupplies.push({ ...supply, stock: stockItems, totalStock });
        }
        setSuppliesWithStock(enrichedSupplies);
        setIsStockLoading(false);
    };

    fetchAllStock();
  }, [supplies, firestore]);
  

  const filteredSupplies = useMemo(() => {
    if (!suppliesWithStock) return [];
    if (!searchTerm) return suppliesWithStock;

    const lowercasedTerm = searchTerm.toLowerCase();
    return suppliesWithStock.filter(item => 
      (item.descricao && item.descricao.toLowerCase().includes(lowercasedTerm)) ||
      (item.codigo && item.codigo.toLowerCase().includes(lowercasedTerm))
    );
  }, [suppliesWithStock, searchTerm]);
  
  const handleGoToCadastro = () => {
    router.push('/dashboard/cadastros/suprimentos');
  }

  const handleOpenMovementDialog = (type: 'entrada' | 'saida', supply: WithDocId<Supply>) => {
    setMovementDialogState({ isOpen: true, type, supply });
  };

  const handleOpenFormDialog = (supply: WithDocId<Supply>) => {
    setFormDialogState({ isOpen: true, supply: supply });
  };
  
  const handleDialogSuccess = () => {
      queryClient.invalidateQueries({ queryKey: suppliesQueryKey });
      // We need to re-trigger the useEffect that fetches stock
      // Invalidating the master data query will do that.
      setMovementDialogState({ isOpen: false, type: 'entrada', supply: null });
      setFormDialogState({ isOpen: false, supply: null });
  };
  
  const isLoading = isLoadingSupplies || isStockLoading;

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inventário Geral de Suprimentos</h1>
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
          <CardTitle>Visão de Estoque</CardTitle>
          <CardDescription>
            Visualize o saldo total de cada item de suprimento.
          </CardDescription>
          <div className="relative pt-4">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
                placeholder="Pesquisar por item ou código..."
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
                <TableHead>Part Number</TableHead>
                <TableHead>Saldo Total</TableHead>
                <TableHead>Estoque Mín.</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={7} className="text-center h-24"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow>
              )}
              {!isLoading && filteredSupplies.length === 0 && (
                <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                        <PackageSearch className="mx-auto h-8 w-8 text-muted-foreground mb-2"/>
                        <p className="text-muted-foreground">Nenhum item em estoque.</p>
                    </TableCell>
                </TableRow>
              )}
              {!isLoading && filteredSupplies.map(item => {
                  const status = item.totalStock <= 0 
                               ? 'Sem Estoque' 
                               : item.totalStock <= item.estoqueMinimo 
                               ? 'Estoque Baixo' 
                               : 'Em Estoque';
                  const statusVariant = status === 'Sem Estoque' ? 'destructive' : status === 'Estoque Baixo' ? 'default' : 'success';

                  return (
                    <TableRow key={item.docId}>
                        <TableCell>
                          <button onClick={() => setImageToView({ src: item.imageUrl || 'https://picsum.photos/seed/supply/48/48', alt: item.descricao || 'Item sem imagem' })}>
                            <Image
                              alt={item.descricao || ''}
                              className="aspect-square rounded-md object-cover cursor-pointer"
                              height="48"
                              src={item.imageUrl || 'https://picsum.photos/seed/supply/48/48'}
                              width="48"
                            />
                          </button>
                        </TableCell>
                      <TableCell>
                        <div className="font-medium">{item.descricao}</div>
                        <div className="text-sm text-muted-foreground">{item.codigo}</div>
                      </TableCell>
                      <TableCell className="font-mono">{item.partNumber}</TableCell>
                      <TableCell className="font-bold">{item.totalStock.toLocaleString()}</TableCell>
                      <TableCell>{item.estoqueMinimo.toLocaleString()}</TableCell>
                      <TableCell>
                          <Badge variant={statusVariant}>{status}</Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="icon" title="Registrar Entrada" onClick={() => handleOpenMovementDialog('entrada', item)}>
                              <LogIn className="h-4 w-4 text-green-600"/>
                          </Button>
                          <Button variant="ghost" size="icon" title="Registrar Saída" onClick={() => handleOpenMovementDialog('saida', item)}>
                              <LogOut className="h-4 w-4 text-orange-600"/>
                          </Button>
                          <Button variant="ghost" size="icon" title="Editar Item Mestre" onClick={() => handleOpenFormDialog(item)}>
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

    