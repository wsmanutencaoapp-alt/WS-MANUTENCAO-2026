'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, where, doc, getDocs, writeBatch, serverTimestamp, addDoc, orderBy, documentId, updateDoc, deleteDoc, onSnapshot, getDoc } from 'firebase/firestore';
import type { PurchaseRequisition, CostCenter, Tool, Supply, PurchaseRequisitionItem, Employee, Supplier } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Search, ShoppingBag, Eye, XCircle, FileText, Trash2, Edit, AlertCircle, Truck, Send } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import PurchaseRequisitionDetailsDialog from '@/components/PurchaseRequisitionDetailsDialog';
import { useQueryClient } from '@tanstack/react-query';
import QuotationDialog from '@/components/QuotationDialog';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ReviewPurchaseOrderDialog from '@/components/ReviewPurchaseOrderDialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import ReceiveItemsDialog from '@/components/ReceiveItemsDialog';
import { RequisitionItemWithDetails } from '@/components/PurchaseRequisitionDetailsDialog';
import { sendPurchaseOrderToSupplier } from '@/lib/email';


const getStatusVariant = (status: PurchaseRequisition['status']) => {
  const variants: { [key in PurchaseRequisition['status']]: 'default' | 'warning' | 'destructive' | 'secondary' | 'success' } = {
    'Aberta': 'secondary',
    'Em Cotação': 'warning',
    'Em Aprovação': 'default',
    'Aprovada': 'success',
    'Aguardando Entrega': 'default',
    'Recebimento Parcial': 'warning',
    'Recebimento Concluído': 'success',
    'Recusada': 'destructive',
    'Concluída': 'secondary',
    'Em Revisão': 'warning',
    'Em Revisão Comprador': 'warning',
    'Parcialmente Atendida': 'warning',
    'Totalmente Atendida': 'success',
    'Cancelada': 'destructive',
    'Pronta para OC': 'success',
  };
  return variants[status] || 'secondary';
};

const getPriorityVariant = (priority: PurchaseRequisition['priority']) => {
    switch(priority) {
        case 'Normal': return 'secondary';
        case 'Média': return 'warning';
        case 'Urgente': return 'destructive';
        default: return 'secondary';
    }
}

const ControleComprasPage = () => {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchTermSC, setSearchTermSC] = useState('');
  const [searchTermOC, setSearchTermOC] = useState('');
  const [selectedRequisition, setSelectedRequisition] = useState<WithDocId<PurchaseRequisition> | null>(null);
  const [requisitionToReview, setRequisitionToReview] = useState<WithDocId<PurchaseRequisition> | null>(null);
  const [itemToReceive, setItemToReceive] = useState<WithDocId<PurchaseRequisition> | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [isSendingOC, setIsSendingOC] = useState<string | null>(null);

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'employees', user.uid) : null),
    [firestore, user]
  );
  const { data: employeeData, isLoading: isEmployeeLoading } = useDoc<Employee>(userDocRef);
  const isAdmin = useMemo(() => employeeData?.accessLevel === 'Admin', [employeeData]);

  // Query for SCs
  const scQueryKey = 'allPurchaseRequisitionsForControl';
  const scQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'purchase_requisitions'), where('type', '==', 'Solicitação de Compra'));
  }, [firestore]);
  const { data: scRequisitions, isLoading: isLoadingSCs, error: scError } = useCollection<WithDocId<PurchaseRequisition>>(scQuery, {
      queryKey: [scQueryKey]
  });

  // Query for OCs
  const ocQueryKey = 'allPurchaseOrdersForControl';
  const ocQuery = useMemoFirebase(() => {
    if(!firestore) return null;
    return query(collection(firestore, 'purchase_requisitions'), where('type', '==', 'Ordem de Compra'));
  }, [firestore]);
  const { data: ocRequisitions, isLoading: isLoadingOCs, error: ocError } = useCollection<WithDocId<PurchaseRequisition>>(ocQuery, {
      queryKey: [ocQueryKey]
  });
  
  const priorityOrder = {
      'Urgente': 1,
      'Média': 2,
      'Normal': 3,
  };

  const sortedAndFilteredSCs = useMemo(() => {
    if (!scRequisitions) return [];

    let relevantRequisitions = scRequisitions.filter(req => ['Aprovada', 'Parcialmente Atendida', 'Em Cotação', 'Em Revisão'].includes(req.status));

    if (searchTermSC) {
        const lowercasedTerm = searchTermSC.toLowerCase();
        relevantRequisitions = relevantRequisitions.filter(req => 
            (req.protocol && req.protocol.toLowerCase().includes(lowercasedTerm)) ||
            req.requesterName.toLowerCase().includes(lowercasedTerm)
        );
    }
    
    return relevantRequisitions.sort((a, b) => {
        const priorityA = priorityOrder[a.priority] || 3;
        const priorityB = priorityOrder[b.priority] || 3;
        if (priorityA !== priorityB) {
            return priorityA - priorityB;
        }
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

  }, [scRequisitions, searchTermSC]);
  
  const filteredOCs = useMemo(() => {
    if(!ocRequisitions) return [];
    if(!searchTermOC) return ocRequisitions;
    const lowercasedTerm = searchTermOC.toLowerCase();
    return ocRequisitions.filter(oc => 
      (oc.protocol && oc.protocol.toLowerCase().includes(lowercasedTerm)) ||
      (oc.supplierName && oc.supplierName.toLowerCase().includes(lowercasedTerm)) ||
      (oc.originalRequisitionProtocol && oc.originalRequisitionProtocol.toLowerCase().includes(lowercasedTerm))
    );
  }, [ocRequisitions, searchTermOC]);

  const handleSuccess = () => {
    setRequisitionToReview(null);
    setSelectedRequisition(null);
    setItemToReceive(null);
    queryClient.invalidateQueries({ queryKey: [scQueryKey] });
    queryClient.invalidateQueries({ queryKey: [ocQueryKey] });
    queryClient.invalidateQueries({ queryKey: ['pendingPurchaseRequisitions'] });
    queryClient.invalidateQueries({ queryKey: ['myPurchaseRequisitions'] });
  };
  
  const handleDeleteRequisition = async (requisitionId: string, type: 'SC' | 'OC') => {
      if (!firestore) return;
      setIsProcessing(requisitionId);
      try {
          const batch = writeBatch(firestore);
          const reqRef = doc(firestore, 'purchase_requisitions', requisitionId);
          
          const itemsRef = collection(reqRef, 'items');
          const itemsSnapshot = await getDocs(itemsRef);
          itemsSnapshot.forEach(itemDoc => {
              batch.delete(itemDoc.ref);
          });
          
          batch.delete(reqRef);
          
          await batch.commit();
          const docType = type === 'SC' ? 'Requisição' : 'Ordem de Compra';
          toast({ title: 'Sucesso', description: `${docType} e seus itens foram excluídos.` });
          
          if(type === 'SC') {
            queryClient.invalidateQueries({ queryKey: [scQueryKey] });
          } else {
            queryClient.invalidateQueries({ queryKey: [ocQueryKey] });
          }

      } catch (err) {
          console.error("Erro ao excluir requisição:", err);
          toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível excluir o documento.' });
      } finally {
          setIsProcessing(null);
      }
  }

  const handleSendToSupplier = async (oc: WithDocId<PurchaseRequisition>) => {
    if (!firestore || !oc.supplierId) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Dados do fornecedor ausentes na OC.' });
        return;
    }
    setIsSendingOC(oc.docId);

    try {
        // 1. Fetch Supplier Email
        const supplierRef = doc(firestore, 'suppliers', oc.supplierId);
        const supplierSnap = await getDoc(supplierRef);
        if (!supplierSnap.exists() || !supplierSnap.data().contactEmail) {
            throw new Error('E-mail de contato do fornecedor não foi encontrado.');
        }
        const supplierEmail = supplierSnap.data().contactEmail;

        // 2. Fetch and Enrich OC Items
        const itemsRef = collection(firestore, 'purchase_requisitions', oc.docId, 'items');
        const itemsSnapshot = await getDocs(itemsRef);
        const items = itemsSnapshot.docs.map(d => ({ ...d.data(), docId: d.id })) as WithDocId<PurchaseRequisitionItem>[];
        if (items.length === 0) throw new Error("A Ordem de Compra não possui itens.");
        
        const supplyIds = items.filter(i => i.itemType === 'supply').map(i => i.itemId);
        const toolIds = items.filter(i => i.itemType === 'tool').map(i => i.itemId);

        const [supplyDocs, toolDocs] = await Promise.all([
          supplyIds.length > 0 ? getDocs(query(collection(firestore, 'supplies'), where('__name__', 'in', supplyIds))) : Promise.resolve({ docs: [] }),
          toolIds.length > 0 ? getDocs(query(collection(firestore, 'tools'), where('__name__', 'in', toolIds))) : Promise.resolve({ docs: [] }),
        ]);

        const masterDataMap = new Map();
        supplyDocs.docs.forEach(d => masterDataMap.set(d.id, { ...d.data(), docId: d.id }));
        toolDocs.docs.forEach(d => masterDataMap.set(d.id, { ...d.data(), docId: d.id }));

        const enrichedItems: RequisitionItemWithDetails[] = items.map(item => ({
            ...item,
            details: masterDataMap.get(item.itemId) || { descricao: 'Item não encontrado', codigo: 'N/A' },
        }));

        // 3. Call the email function
        await sendPurchaseOrderToSupplier(supplierEmail, oc, enrichedItems);

        // 4. Update the OC with the sent timestamp
        const ocRef = doc(firestore, 'purchase_requisitions', oc.docId);
        await updateDoc(ocRef, {
            lastSentToSupplierAt: new Date().toISOString(),
        });
        
        queryClient.invalidateQueries({ queryKey: [ocQueryKey] });
        toast({ title: 'Sucesso!', description: `Ordem de Compra enviada para ${supplierEmail}.` });

    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Erro ao Enviar OC', description: error.message });
    } finally {
        setIsSendingOC(null);
    }
  };


  const isLoading = isLoadingSCs || isLoadingOCs || isEmployeeLoading;

  return (
    <>
    <TooltipProvider>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Controle de Compras</h1>
        
        <Tabs defaultValue="requisicoes">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="requisicoes">Requisições para Cotação</TabsTrigger>
                <TabsTrigger value="ordens">Ordens de Compra</TabsTrigger>
            </TabsList>
            <TabsContent value="requisicoes">
                <Card>
                <CardHeader>
                    <CardTitle>Requisições Aprovadas e Em Cotação</CardTitle>
                    <CardDescription>
                    Gerencie as requisições de compra aprovadas e inicie o processo de cotação e compra.
                    </CardDescription>
                    <div className="relative pt-4">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Pesquisar por protocolo, solicitante..."
                        value={searchTermSC}
                        onChange={(e) => setSearchTermSC(e.target.value)}
                        className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[336px]"
                    />
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead>Protocolo</TableHead>
                        <TableHead>Prioridade</TableHead>
                        <TableHead>Solicitante</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading && (
                        <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                        )}
                        {scError && (
                        <TableRow><TableCell colSpan={5} className="h-24 text-center text-destructive">{scError.message}</TableCell></TableRow>
                        )}
                        {!isLoading && sortedAndFilteredSCs.length === 0 && (
                        <TableRow><TableCell colSpan={5} className="h-24 text-center">Nenhuma requisição aprovada ou em cotação encontrada.</TableCell></TableRow>
                        )}
                        {!isLoading && sortedAndFilteredSCs.map(req => (
                        <TableRow key={req.docId} className={cn(req.status === 'Em Revisão' && 'bg-yellow-50 dark:bg-yellow-900/20')}>
                            <TableCell className="font-mono">{req.protocol}</TableCell>
                            <TableCell><Badge variant={getPriorityVariant(req.priority)}>{req.priority}</Badge></TableCell>
                            <TableCell>{req.requesterName}</TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                  <Badge variant={getStatusVariant(req.status)}>{req.status}</Badge>
                                  {req.status === 'Em Revisão' && req.rejectionReason && (
                                     <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="cursor-help">
                                              <AlertCircle className="h-4 w-4 text-orange-500" />
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p className="max-w-xs">Motivo da Devolução: {req.rejectionReason}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                               <Button variant="default" size="sm" onClick={() => setSelectedRequisition(req)}>
                                  <Eye className="mr-2 h-4 w-4"/>
                                  Ver e Atender Itens
                                </Button>
                                {isAdmin && (
                                    <>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="destructive" size="icon" disabled={isProcessing === req.docId} title="Excluir Requisição">
                                                    {isProcessing === req.docId ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4" />}
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Tem certeza que deseja excluir permanentemente a requisição <span className="font-bold">{req.protocol}</span>? Esta ação não pode ser desfeita.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteRequisition(req.docId, 'SC')}>
                                                        Sim, Excluir
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </>
                                )}
                            </TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                    </Table>
                </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="ordens">
                <Card>
                    <CardHeader>
                        <CardTitle>Ordens de Compra</CardTitle>
                        <CardDescription>Gerencie as OCs, acompanhe entregas, revise e finalize o processo.</CardDescription>
                         <div className="relative pt-4">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Pesquisar por OC, fornecedor ou SC de origem..."
                                value={searchTermOC}
                                onChange={(e) => setSearchTermOC(e.target.value)}
                                className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[336px]"
                            />
                        </div>
                    </CardHeader>
                    <CardContent>
                       <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Protocolo OC</TableHead>
                                    <TableHead>Fornecedor</TableHead>
                                    <TableHead>Valor Total</TableHead>
                                    <TableHead>Data Aprovação</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                             <TableBody>
                                {isLoading && (
                                <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                                )}
                                {ocError && (
                                <TableRow><TableCell colSpan={6} className="h-24 text-center text-destructive">{ocError.message}</TableCell></TableRow>
                                )}
                                {!isLoading && filteredOCs.length === 0 && (
                                    <TableRow><TableCell colSpan={6} className="h-24 text-center">Nenhuma Ordem de Compra encontrada.</TableCell></TableRow>
                                )}
                                 {!isLoading && filteredOCs.map(oc => {
                                  const showReason = (oc.status === 'Em Revisão Comprador') && oc.rejectionReason;
                                  return (
                                    <TableRow key={oc.docId}>
                                        <TableCell className="font-mono">
                                            <p>{oc.protocol}</p>
                                            {oc.originalRequisitionProtocol && <p className="text-xs text-muted-foreground">Origem: {oc.originalRequisitionProtocol}</p>}
                                        </TableCell>
                                        <TableCell>{oc.supplierName || 'N/A'}</TableCell>
                                        <TableCell className="font-medium">{oc.totalValue?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                                        <TableCell>{format(new Date(oc.createdAt), 'dd/MM/yyyy')}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Badge variant={getStatusVariant(oc.status)}>{oc.status}</Badge>
                                                {showReason && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                        <span className="cursor-help">
                                                            <AlertCircle className="h-4 w-4 text-orange-500" />
                                                        </span>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                        <p className="max-w-xs">Motivo da Devolução: {oc.rejectionReason}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right space-x-1">
                                            {(oc.status === 'Aguardando Entrega' || oc.status === 'Recebimento Parcial') && (
                                                <>
                                                 <Button variant="default" size="sm" onClick={() => setItemToReceive(oc)}>
                                                    <Truck className="mr-2 h-4 w-4" />
                                                    Receber
                                                </Button>
                                                 <Button variant="secondary" size="sm" onClick={() => handleSendToSupplier(oc)} disabled={isSendingOC === oc.docId}>
                                                    {isSendingOC === oc.docId ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />}
                                                    Enviar
                                                </Button>
                                                </>
                                            )}
                                            {oc.status === 'Em Revisão Comprador' ? (
                                                <Button variant="secondary" size="sm" onClick={() => setRequisitionToReview(oc)}>
                                                    <Edit className="mr-2 h-4 w-4" />
                                                    Revisar e Reenviar
                                                </Button>
                                            ) : null}

                                            <Button variant="outline" size="icon" onClick={() => setSelectedRequisition(oc)}>
                                                <Eye className="h-4 w-4" />
                                            </Button>

                                            {isAdmin && (
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="destructive" size="icon" disabled={isProcessing === oc.docId} title="Excluir Ordem de Compra">
                                                            {isProcessing === oc.docId ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4" />}
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Tem certeza que deseja excluir permanentemente a Ordem de Compra <span className="font-bold">{oc.protocol}</span>? Esta ação não pode ser desfeita.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeleteRequisition(oc.docId, 'OC')}>
                                                                Sim, Excluir
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                  )
                                })}
                            </TableBody>
                       </Table>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
      </div>
      </TooltipProvider>

      {selectedRequisition && (
          <PurchaseRequisitionDetailsDialog
            requisition={selectedRequisition}
            isOpen={!!selectedRequisition}
            onClose={() => setSelectedRequisition(null)}
            onActionSuccess={handleSuccess}
          />
      )}

      {requisitionToReview && requisitionToReview.type === 'Ordem de Compra' && (
        <ReviewPurchaseOrderDialog
            purchaseOrder={requisitionToReview}
            isOpen={!!requisitionToReview}
            onClose={() => setRequisitionToReview(null)}
            onSuccess={handleSuccess}
        />
      )}

      {itemToReceive && (
        <ReceiveItemsDialog
          isOpen={!!itemToReceive}
          onClose={() => setItemToReceive(null)}
          purchaseOrder={itemToReceive}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
};

export default ControleComprasPage;
