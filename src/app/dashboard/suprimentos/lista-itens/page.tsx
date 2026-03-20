'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import {
  collection,
  query,
  orderBy,
  doc,
  deleteDoc,
  collectionGroup,
  onSnapshot,
} from 'firebase/firestore';
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
import { Loader2, PlusCircle, Search, LogIn, LogOut, Edit, PackageSearch, ChevronDown, Printer, ExternalLink, Trash2, ShoppingCart, AlertTriangle, AlertCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import SupplyMovementDialog from '@/components/SupplyMovementDialog';
import { format, parseISO, differenceInDays } from 'date-fns';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import EditStockItemDialog from '@/components/EditStockItemDialog';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';


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
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
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

  const [imageToView, setImageToView] = useState<{ src: string, alt: string } | null>(null);
  const [stockToPrint, setStockToPrint] = useState<EnrichedStockItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'employees', user.uid) : null),
    [firestore, user]
  );
  const { data: employeeData, isLoading: isEmployeeLoading } = useDoc<Employee>(userDocRef);
  const isAdmin = useMemo(() => employeeData?.accessLevel === 'Admin' || user?.uid === 'SOID8C723XUmlniI3mpjBmBPA5v1', [employeeData, user]);

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

  useEffect(() => {
    if (!supplies || !firestore) {
        if (!isLoadingSupplies) {
            setIsStockLoading(false);
            setEnrichedStock([]);
        }
        return;
    }

    setIsStockLoading(true);
    const supplyMap = new Map(supplies.map(s => [s.docId, s]));
    const stockQuery = query(collectionGroup(firestore, 'stock'));
    
    const unsubscribe = onSnapshot(stockQuery, (snapshot) => {
        const allStockItems: EnrichedStockItem[] = [];
        snapshot.forEach(doc => {
            const stockData = { docId: doc.id, ...doc.data() } as WithDocId<SupplyStock>;
            const supplyId = doc.ref.parent.parent?.id;
            
            if (supplyId) {
                const supplyInfo = supplyMap.get(supplyId);
                if (supplyInfo) {
                    allStockItems.push({
                        ...stockData,
                        supplyInfo
                    });
                }
            }
        });
        setEnrichedStock(allStockItems);
        setIsStockLoading(false);
    }, (err) => {
        console.error("Error fetching stock collection group:", err);
        setIsStockLoading(false);
    });

    return () => unsubscribe();
  }, [supplies, firestore, isLoadingSupplies]);
  
  // Calculate total quantities per supply ID for visual indicators (Real-time derived)
  const totalsPerSupply = useMemo(() => {
    const totals = new Map<string, number>();
    enrichedStock.forEach(item => {
        const current = totals.get(item.supplyInfo.docId) || 0;
        totals.set(item.supplyInfo.docId, current + item.quantidade);
    });
    return totals;
  }, [enrichedStock]);

  // Dashboard Stats (Real-time derived)
  const stats = useMemo(() => {
    if (!supplies || !enrichedStock) return { noStock: 0, lowStock: 0, nearExpiry: 0 };

    let noStock = 0;
    let lowStock = 0;
    supplies.forEach(s => {
        const total = totalsPerSupply.get(s.docId) || 0;
        if (total === 0) noStock++;
        else if (total <= s.estoqueMinimo) lowStock++;
    });

    const nearExpiry = enrichedStock.filter(item => {
        if (!item.dataValidade) return false;
        const days = differenceInDays(new Date(item.dataValidade), new Date());
        return days >= 0 && days <= 30;
    }).length;

    return { noStock, lowStock, nearExpiry };
  }, [supplies, enrichedStock, totalsPerSupply]);

  const filteredStock = useMemo(() => {
    if (!enrichedStock) return [];
    
    let result = enrichedStock;

    if (showLowStockOnly) {
        result = result.filter(item => {
            const total = totalsPerSupply.get(item.supplyInfo.docId) || 0;
            return total <= item.supplyInfo.estoqueMinimo;
        });
    }

    if (searchTerm) {
        const lowercasedTerm = searchTerm.toLowerCase();
        result = result.filter(item => 
          (item.supplyInfo.descricao && item.supplyInfo.descricao.toLowerCase().includes(lowercasedTerm)) ||
          (item.supplyInfo.codigo && item.supplyInfo.codigo.toLowerCase().includes(lowercasedTerm)) ||
          (item.supplyInfo.partNumber && item.supplyInfo.partNumber.toLowerCase().includes(lowercasedTerm)) ||
          (item.loteInterno && item.loteInterno.toLowerCase().includes(lowercasedTerm)) ||
          (item.localizacao && item.localizacao.toLowerCase().includes(lowercasedTerm))
        );
    }
    
    return result;
  }, [enrichedStock, searchTerm, showLowStockOnly, totalsPerSupply]);
  
  const handleGoToCadastro = () => {
    router.push('/dashboard/cadastros/suprimentos');
  }

  const handleOpenMovementDialog = (type: 'entrada' | 'saida', supply: WithDocId<Supply> | null) => {
    setMovementDialogState({ isOpen: true, type, supply });
  };

  const handleDialogSuccess = (newItem?: EnrichedStockItem) => {
      queryClient.invalidateQueries({ queryKey: suppliesQueryKey });
      setMovementDialogState({ isOpen: false, type: 'entrada', supply: null });
      setFormDialogState({ isOpen: false, supply: null });
      setEditStockDialogState({ isOpen: false, stockItem: null });

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

  const handleQuickRequisition = (item: EnrichedStockItem) => {
      router.push(`/dashboard/compras/requisicao?itemId=${item.supplyInfo.docId}&itemType=supply`);
  };

  const isLoading = isLoadingSupplies || isStockLoading;

  return (
    <div className="space-y-6">
       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card 
                className={cn(
                    "cursor-pointer transition-all hover:shadow-md",
                    stats.noStock > 0 ? "border-destructive bg-destructive/5" : "",
                    showLowStockOnly && stats.noStock > 0 ? "ring-2 ring-destructive" : ""
                )}
                onClick={() => stats.noStock > 0 && setShowLowStockOnly(!showLowStockOnly)}
            >
                <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                    <div>
                        <CardTitle className="text-sm font-medium">Sem Estoque</CardTitle>
                        <CardDescription className="text-xs">Itens com saldo zero</CardDescription>
                    </div>
                    <AlertCircle className={cn("h-5 w-5", stats.noStock > 0 ? "text-destructive" : "text-muted-foreground")} />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    <div className="text-2xl font-bold">{stats.noStock}</div>
                </CardContent>
            </Card>
            <Card 
                className={cn(
                    "cursor-pointer transition-all hover:shadow-md",
                    stats.lowStock > 0 ? "border-orange-500 bg-orange-500/5" : "",
                    showLowStockOnly && !showLowStockOnly ? "" : "" // Logic for selection state if needed
                )}
                onClick={() => stats.lowStock > 0 && setShowLowStockOnly(!showLowStockOnly)}
            >
                <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                    <div>
                        <CardTitle className="text-sm font-medium">Estoque Baixo</CardTitle>
                        <CardDescription className="text-xs">Igual ou abaixo do mínimo</CardDescription>
                    </div>
                    <AlertTriangle className={cn("h-5 w-5", stats.lowStock > 0 ? "text-orange-500" : "text-muted-foreground")} />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    <div className="text-2xl font-bold">{stats.lowStock}</div>
                </CardContent>
            </Card>
            <Card className={cn(stats.nearExpiry > 0 ? "border-yellow-500 bg-yellow-500/5" : "")}>
                <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                    <div>
                        <CardTitle className="text-sm font-medium">Vencimento Próximo</CardTitle>
                        <CardDescription className="text-xs">Próximos 30 dias</CardDescription>
                    </div>
                    <AlertCircle className={cn("h-5 w-5", stats.nearExpiry > 0 ? "text-yellow-500" : "text-muted-foreground")} />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    <div className="text-2xl font-bold">{stats.nearExpiry}</div>
                </CardContent>
            </Card>
       </div>

       <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Inventário de Suprimentos por Lote</h1>
        <div className="flex flex-wrap gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <LogIn className="mr-2 h-4 w-4"/>
                  Registrar Entrada <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setMovementDialogState({ isOpen: true, type: 'entrada', supply: null })}>
                  Entrada Avulsa / Manual
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => router.push('/dashboard/compras/controle-compras')}>
                  Receber via Ordem de Compra
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <CardTitle>Visão de Estoque por Lote</CardTitle>
                <CardDescription>Visualize cada lote de item individualmente no estoque.</CardDescription>
            </div>
            <div className="flex items-center space-x-2 bg-muted/50 p-2 rounded-lg border">
                <Switch 
                    id="low-stock-filter" 
                    checked={showLowStockOnly} 
                    onCheckedChange={setShowLowStockOnly} 
                />
                <Label htmlFor="low-stock-filter" className="text-sm font-medium cursor-pointer">Mostrar apenas estoque baixo</Label>
            </div>
          </div>
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
                        <p className="text-muted-foreground">Nenhum item encontrado.</p>
                    </TableCell>
                </TableRow>
              )}
              {!isLoading && filteredStock.map(item => {
                  const { supplyInfo } = item;
                  const totalQty = totalsPerSupply.get(supplyInfo.docId) || 0;
                  
                  // Color logic based on total supply health
                  const isLowStock = totalQty <= supplyInfo.estoqueMinimo;
                  const isWarningStock = totalQty > supplyInfo.estoqueMinimo && totalQty <= (supplyInfo.estoqueMinimo * 1.25);
                  
                  const quantityColorClass = isLowStock 
                    ? "text-destructive" 
                    : isWarningStock 
                    ? "text-orange-500" 
                    : "text-foreground";

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
                    <TableCell>
                        <div className={cn("font-bold", quantityColorClass)}>
                            {item.quantidade.toLocaleString()} {supplyInfo.unidadeMedida}
                        </div>
                        {item.pesoLiquido !== undefined && <div className="text-xs text-muted-foreground">{item.pesoLiquido.toLocaleString()} {supplyInfo.unidadeSecundaria}</div>}
                    </TableCell>
                    <TableCell>
                        {item.dataValidade ? (
                            <div className="flex flex-col">
                                <span>{format(parseISO(item.dataValidade), 'dd/MM/yyyy')}</span>
                                {differenceInDays(new Date(item.dataValidade), new Date()) <= 30 && (
                                    <Badge variant="warning" className="text-[10px] py-0 h-4 w-fit">Vencendo</Badge>
                                )}
                            </div>
                        ) : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                        <Button variant="outline" size="icon" title="Solicitar Compra deste Item" className="text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => handleQuickRequisition(item)}>
                            <ShoppingCart className="h-4 w-4"/>
                        </Button>
                        <Button variant="ghost" size="icon" title="Registrar Saída deste Lote" onClick={() => setMovementDialogState({ isOpen: true, type: 'saida', supply: supplyInfo })}>
                            <LogOut className="h-4 w-4 text-orange-600"/>
                        </Button>
                        <Button variant="ghost" size="icon" title="Editar Lote" onClick={() => setEditStockDialogState({ isOpen: true, stockItem: item })}>
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
                                        Tem certeza que deseja excluir o lote <span className="font-bold">{item.loteInterno}</span>? Esta ação não pode ser desfeita.
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
      
      {editStockDialogState.isOpen && (
        <EditStockItemDialog
          isOpen={editStockDialogState.isOpen}
          onClose={() => setEditStockDialogState({ isOpen: false, stockItem: null })}
          onSuccess={handleDialogSuccess}
          stockItem={editStockDialogState.stockItem}
        />
      )}

      {imageToView && (
        <Dialog open={!!imageToView} onOpenChange={() => setImageToView(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{imageToView.alt}</DialogTitle></DialogHeader>
            <div className="relative w-full aspect-square">
              <Image src={imageToView.src} alt={imageToView.alt} fill className="object-contain rounded-md" />
            </div>
          </DialogContent>
        </Dialog>
      )}

       {stockToPrint && (
        <Dialog open={!!stockToPrint} onOpenChange={() => setStockToPrint(null)}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Etiqueta de Suprimento</DialogTitle>
                    <DialogDescription>Confirme a etiqueta e clique em imprimir.</DialogDescription>
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
                    <Button onClick={executePrint}><Printer className="mr-2 h-4 w-4"/>Imprimir</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default SuprimentosPage;
