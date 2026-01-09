'use client';

import { useState, useMemo, useEffect, Fragment } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, orderBy, doc, getDocs, deleteDoc } from 'firebase/firestore';
import type { Supply, SupplyStock, Employee } from '@/lib/types';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, Search, LogIn, LogOut, Edit, PackageSearch, ChevronDown, ChevronRight, Printer, ExternalLink, Trash2, Undo } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import SupplyMovementDialog from '@/components/SupplyMovementDialog';
import { format, parseISO } from 'date-fns';
import Image from 'next/image';
import SupplyFormDialog from '@/components/SupplyFormDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import EditStockItemDialog from '@/components/EditStockItemDialog';
import { useToast } from '@/hooks/use-toast';
import ReturnMovementDialog from '@/components/ReturnMovementDialog';


type EnrichedStockItem = WithDocId<SupplyStock> & {
    supplyInfo: WithDocId<Supply>;
};


const SuprimentosPage = () => {
  const firestore = useFirestore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useUser();

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
  
  const [editStockDialogState, setEditStockDialogState] = useState<{
    isOpen: boolean;
    stockItem: EnrichedStockItem | null;
  }>({ isOpen: false, stockItem: null });

  const [returnDialogState, setReturnDialogState] = useState<{
    isOpen: boolean;
    stockItem: EnrichedStockItem | null;
  }>({ isOpen: false, stockItem: null });

  const [imageToView, setImageToView] = useState<{ src: string, alt: string } | null>(null);
  const [stockToPrint, setStockToPrint] = useState<EnrichedStockItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'employees', user.uid) : null),
    [firestore, user]
  );
  const { data: employeeData } = useDoc<Employee>(userDocRef);
  const isAdmin = useMemo(() => employeeData?.accessLevel === 'Admin', [employeeData]);

  
  // 1. Fetch all master supply data 
  const suppliesQueryKey = ['suppliesMasterDataForStockList'];
  const suppliesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'supplies'), orderBy('codigo')) : null),
    [firestore]
  );
  const { data: supplies, isLoading: isLoadingSupplies, error } = useCollection<WithDocId<Supply>>(suppliesQuery, {
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
  }, [supplies, firestore, queryClient]);
  

  const filteredStock = useMemo(() => {
    if (!enrichedStock) return [];
    if (!searchTerm) return enrichedStock;

    const lowercasedTerm = searchTerm.toLowerCase();
    return enrichedStock.filter(item => 
      (item.supplyInfo.descricao && item.supplyInfo.descricao.toLowerCase().includes(lowercasedTerm)) ||
      (item.supplyInfo.codigo && item.supplyInfo.codigo.toLowerCase().includes(lowercasedTerm)) ||
      (item.supplyInfo.partNumber && item.supplyInfo.partNumber.toLowerCase().includes(lowercasedTerm)) ||
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
  
  const handleOpenEditStockDialog = (item: EnrichedStockItem) => {
    setEditStockDialogState({ isOpen: true, stockItem: item });
  };
  
  const handleOpenReturnDialog = (item: EnrichedStockItem) => {
    setReturnDialogState({ isOpen: true, stockItem: item });
  };

  const handleDialogSuccess = (newItem?: EnrichedStockItem) => {
      // Re-trigger the stock fetching
      queryClient.invalidateQueries({ queryKey: suppliesQueryKey });
      setMovementDialogState({ isOpen: false, type: 'entrada', supply: null });
      setFormDialogState({ isOpen: false, supply: null });
      setEditStockDialogState({ isOpen: false, stockItem: null });
      setReturnDialogState({ isOpen: false, stockItem: null });

      if (newItem) {
        setStockToPrint(newItem);
      }
  };
  
  const handleDeleteStockItem = async (item: EnrichedStockItem) => {
    if (!firestore) return;
    setIsDeleting(item.docId);
    try {
        const stockDocRef = doc(firestore, 'supplies', item.supplyInfo.docId, 'stock', item.docId);
        await deleteDoc(stockDocRef);
        toast({ title: 'Sucesso!', description: 'Lote de suprimento excluído.' });
        // Instead of refetching everything, we can just remove the item from the local state for a faster UI update.
        setEnrichedStock(prev => prev.filter(stock => stock.docId !== item.docId));
    } catch (err) {
        console.error("Erro ao excluir lote:", err);
        toast({ variant: 'destructive', title: 'Erro na Operação', description: 'Não foi possível excluir o lote.' });
    } finally {
        setIsDeleting(null);
    }
  };

  const executePrint = () => {
    const printableArea = document.getElementById('printable-label-area');
    if (!printableArea) return;

    const printWindow = window.open('', '', 'height=600,width=800');
    if (printWindow) {
        printWindow.document.write('<html><head><title>Imprimir Etiquetas</title>');
        printWindow.document.write('<style>@media print { @page { size: 100mm 60mm; margin: 0; } body { margin: 0; padding: 0; font-family: sans-serif; -webkit-print-color-adjust: exact; } .label-container { width: 100%; height: 100%; display: grid; grid-template-columns: 1fr auto; align-items: center; box-sizing: border-box; padding: 5mm; gap: 5mm; break-inside: avoid; } .info { display: flex; flex-direction: column; justify-content: center; } .desc { font-size: 16px; font-weight: bold; } .code { font-size: 12px; font-family: monospace; } .lot { font-size: 18px; font-weight: bold; font-family: monospace; } .due-date { font-size: 14px; font-weight: bold; } .qr-code { width: 45mm; height: 45mm; justify-self: end; }  }</style>');
        printWindow.document.write('</head><body>');
        printWindow.document.write(printableArea.innerHTML);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 250);
    }
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
                placeholder="Pesquisar por item, P/N, código, lote ou localização..."
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
                <TableHead>Item (Código / P/N)</TableHead>
                <TableHead>Lotes (Interno/Fornecedor)</TableHead>
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
              {error && (
                <TableRow><TableCell colSpan={7} className="text-center text-destructive h-24">{error.message}</TableCell></TableRow>
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
                        <div className="text-sm text-muted-foreground font-mono">{supplyInfo.codigo}</div>
                        <div className="text-xs text-muted-foreground">{supplyInfo.partNumber}</div>
                    </TableCell>
                    <TableCell>
                        <div className="font-mono text-sm">{item.loteInterno}</div>
                        {item.loteFornecedor && <div className="font-mono text-xs text-muted-foreground">F: {item.loteFornecedor}</div>}
                    </TableCell>
                    <TableCell>{item.localizacao}</TableCell>
                    <TableCell className="font-bold">{item.quantidade.toLocaleString()}</TableCell>
                    <TableCell>{item.dataValidade ? format(parseISO(item.dataValidade), 'dd/MM/yyyy') : 'N/A'}</TableCell>
                    <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" title="Registrar Saída deste Lote" onClick={() => handleOpenMovementDialog('saida', supplyInfo)}>
                            <LogOut className="h-4 w-4 text-orange-600"/>
                        </Button>
                        <Button variant="ghost" size="icon" title="Editar Lote" onClick={() => handleOpenEditStockDialog(item)}>
                            <Edit className="h-4 w-4"/>
                        </Button>
                        {item.documentoUrl && (
                             <Button asChild variant="ghost" size="icon" title="Ver Documento do Lote">
                                <a href={item.documentoUrl} target="_blank" rel="noopener noreferrer">
                                   <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                        )}
                        <Button variant="ghost" size="icon" title="Imprimir Etiqueta do Lote" onClick={() => setStockToPrint(item)}>
                            <Printer className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" title="Excluir Lote" disabled={isDeleting === item.docId}>
                                        {isDeleting === item.docId ? <Loader2 className="animate-spin h-4 w-4"/> : <Trash2 className="h-4 w-4 text-destructive"/>}
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                    <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Tem certeza que deseja excluir o lote <span className="font-bold">{item.loteInterno}</span>? Esta ação não pode ser desfeita e não irá gerar um registro de movimentação.
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteStockItem(item)}>
                                        Sim, Excluir
                                    </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
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

      {editStockDialogState.isOpen && (
        <EditStockItemDialog
          isOpen={editStockDialogState.isOpen}
          onClose={() => setEditStockDialogState({ isOpen: false, stockItem: null })}
          onSuccess={handleDialogSuccess}
          stockItem={editStockDialogState.stockItem}
        />
      )}
      
       {returnDialogState.isOpen && returnDialogState.stockItem && (
        <ReturnMovementDialog
          isOpen={returnDialogState.isOpen}
          onClose={() => setReturnDialogState({ isOpen: false, stockItem: null })}
          stockItem={returnDialogState.stockItem}
          onSuccess={handleDialogSuccess}
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

       {stockToPrint && (
        <Dialog open={!!stockToPrint} onOpenChange={() => setStockToPrint(null)}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Etiqueta de Suprimento</DialogTitle>
                    <DialogDescription>
                        Confirme a etiqueta e clique em imprimir. Dimensões: 100mm x 60mm.
                    </DialogDescription>
                </DialogHeader>
                <div id="printable-label-area" className="flex justify-center p-4 bg-muted/50 rounded-md">
                    <div className="label-container grid grid-cols-[1fr_auto] items-center p-1 border rounded-lg bg-white" style={{ width: '377px', height: '226px', boxSizing: 'content-box', gap: '5mm', padding: '5mm' }}>
                       <div className="info flex flex-col justify-center h-full">
                           <p className="desc font-bold text-black" style={{fontSize: '16px'}}>{stockToPrint.supplyInfo.descricao}</p>
                           <p className="code font-mono text-black" style={{fontSize: '12px'}}>{stockToPrint.supplyInfo.codigo}</p>
                           <p className="lot font-mono font-bold text-black mt-2" style={{fontSize: '18px'}}>{stockToPrint.loteInterno}</p>
                           {stockToPrint.dataValidade && <p className="due-date font-bold text-black mt-1" style={{fontSize: '14px'}}>VAL: {format(parseISO(stockToPrint.dataValidade), 'dd/MM/yyyy')}</p>}
                       </div>
                       <div className="qr-code self-center" style={{width: '170px', height: '170px'}}>
                            <Image
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=170x170&data=${encodeURIComponent(`${stockToPrint.supplyInfo.codigo}/${stockToPrint.loteInterno}`)}`}
                                alt={`QR Code for ${stockToPrint.loteInterno}`}
                                width={170}
                                height={170}
                            />
                       </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setStockToPrint(null)}>Cancelar</Button>
                    <Button onClick={executePrint}>
                        <Printer className="mr-2 h-4 w-4"/>
                        Imprimir
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      )}

    </div>
  );
};

export default SuprimentosPage;
