'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, where, doc, getDocs, writeBatch, serverTimestamp, addDoc, orderBy, documentId, updateDoc, deleteDoc } from 'firebase/firestore';
import type { PurchaseRequisition, CostCenter, Tool, Supply, PurchaseRequisitionItem, Employee } from '@/lib/types';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Search, ShoppingBag, Eye, XCircle, FileText, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import PurchaseRequisitionDetailsDialog from '@/components/PurchaseRequisitionDetailsDialog';
import { useQueryClient } from '@tanstack/react-query';
import QuotationDialog from '@/components/QuotationDialog';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


type RequisitionWithProgress = WithDocId<PurchaseRequisition> & {
    progress: number;
    totalItems: number;
};

const getStatusVariant = (status: PurchaseRequisition['status']) => {
  const variants: { [key in PurchaseRequisition['status']]: 'default' | 'warning' | 'destructive' | 'secondary' | 'success' } = {
    'Aberta': 'secondary',
    'Em Cotação': 'default',
    'Em Aprovação': 'default',
    'Aprovada': 'success',
    'Aguardando Entrega': 'default',
    'Recusada': 'destructive',
    'Concluída': 'secondary',
    'Em Revisão': 'warning',
    'Parcialmente Atendida': 'warning',
    'Totalmente Atendida': 'success',
    'Cancelada': 'destructive'
  };
  return variants[status] || 'secondary';
};

const getPriorityVariant = (priority: PurchaseRequisition['priority']) => {
    switch(priority) {
        case 'Normal': return 'secondary';
        case 'Urgente': return 'warning';
        case 'Muito Urgente': return 'destructive';
        default: return 'secondary';
    }
}

const priorityOrder: Record<PurchaseRequisition['priority'], number> = {
    'Muito Urgente': 1,
    'Urgente': 2,
    'Normal': 3,
};

const ControleComprasPage = () => {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchTermSC, setSearchTermSC] = useState('');
  const [searchTermOC, setSearchTermOC] = useState('');
  const [selectedRequisition, setSelectedRequisition] = useState<WithDocId<PurchaseRequisition> | null>(null);
  const [requisitionsWithProgress, setRequisitionsWithProgress] = useState<RequisitionWithProgress[]>([]);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

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
    return query(collection(firestore, 'purchase_requisitions'), where('type', '==', 'Ordem de Compra'), where('status', '==', 'Aprovada'));
  }, [firestore]);
  const { data: ocRequisitions, isLoading: isLoadingOCs, error: ocError } = useCollection<WithDocId<PurchaseRequisition>>(ocQuery, {
      queryKey: [ocQueryKey]
  });
  
  useEffect(() => {
    if (!scRequisitions || !firestore) return;

    const fetchProgress = async () => {
      const enrichedReqs: RequisitionWithProgress[] = [];
      for (const req of scRequisitions) {
        const itemsRef = collection(firestore, 'purchase_requisitions', req.docId, 'items');
        const itemsSnapshot = await getDocs(itemsRef);
        const totalItems = itemsSnapshot.size;
        let attendedItems = 0;
        
        itemsSnapshot.forEach(doc => {
          const item = doc.data() as PurchaseRequisitionItem;
          if (['Em Cotação', 'Cotado', 'Recebido', 'Cancelado'].includes(item.status)) {
            attendedItems++;
          }
        });
        
        const progress = totalItems > 0 ? (attendedItems / totalItems) * 100 : 0;
        enrichedReqs.push({ ...req, progress, totalItems });
      }
      setRequisitionsWithProgress(enrichedReqs);
    };

    fetchProgress();
  }, [scRequisitions, firestore]);
  

  const sortedAndFilteredSCs = useMemo(() => {
    if (!requisitionsWithProgress) return [];

    let relevantRequisitions = requisitionsWithProgress.filter(req => ['Aprovada', 'Parcialmente Atendida', 'Em Cotação'].includes(req.status));

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

  }, [requisitionsWithProgress, searchTermSC]);
  
  const filteredOCs = useMemo(() => {
    if(!ocRequisitions) return [];
    if(!searchTermOC) return ocRequisitions;
    const lowercasedTerm = searchTermOC.toLowerCase();
    return ocRequisitions.filter(oc => 
      (oc.protocol && oc.protocol.toLowerCase().includes(lowercasedTerm)) ||
      (oc.supplierName && oc.supplierName.toLowerCase().includes(lowercasedTerm))
    );
  }, [ocRequisitions, searchTermOC]);

  const handleSuccess = () => {
    setSelectedRequisition(null);
    queryClient.invalidateQueries({ queryKey: [scQueryKey] });
    queryClient.invalidateQueries({ queryKey: [ocQueryKey] });
    queryClient.invalidateQueries({ queryKey: ['pendingPurchaseRequisitions'] });
  };
  
  const handleDeleteRequisition = async (requisitionId: string) => {
      if (!firestore) return;
      setIsProcessing(requisitionId);
      try {
          const batch = writeBatch(firestore);
          const reqRef = doc(firestore, 'purchase_requisitions', requisitionId);
          
          // Delete items in subcollection
          const itemsRef = collection(reqRef, 'items');
          const itemsSnapshot = await getDocs(itemsRef);
          itemsSnapshot.forEach(itemDoc => {
              batch.delete(itemDoc.ref);
          });
          
          // Delete main document
          batch.delete(reqRef);
          
          await batch.commit();
          toast({ title: 'Sucesso', description: 'Requisição e seus itens foram excluídos.' });
          queryClient.invalidateQueries({ queryKey: [scQueryKey] });
      } catch (err) {
          console.error("Erro ao excluir requisição:", err);
          toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível excluir a requisição.' });
      } finally {
          setIsProcessing(null);
      }
  }


  const isLoading = isLoadingSCs || isLoadingOCs || isEmployeeLoading;

  return (
    <>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Controle de Compras</h1>
        
        <Tabs defaultValue="requisicoes">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="requisicoes">Requisições para Cotação</TabsTrigger>
                <TabsTrigger value="ordens">Ordens de Compra Aprovadas</TabsTrigger>
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
                        <TableHead className="w-[20%]">Atendimento</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading && (
                        <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                        )}
                        {scError && (
                        <TableRow><TableCell colSpan={6} className="h-24 text-center text-destructive">{scError.message}</TableCell></TableRow>
                        )}
                        {!isLoading && sortedAndFilteredSCs.length === 0 && (
                        <TableRow><TableCell colSpan={6} className="h-24 text-center">Nenhuma requisição aprovada ou em cotação encontrada.</TableCell></TableRow>
                        )}
                        {!isLoading && sortedAndFilteredSCs.map(req => (
                        <TableRow key={req.docId}>
                            <TableCell className="font-mono">{req.protocol}</TableCell>
                            <TableCell><Badge variant={getPriorityVariant(req.priority)}>{req.priority}</Badge></TableCell>
                            <TableCell>{req.requesterName}</TableCell>
                            <TableCell>
                                <Badge variant={getStatusVariant(req.status)}>{req.status}</Badge>
                            </TableCell>
                            <TableCell>
                                {req.totalItems > 0 ? (
                                <div className="flex flex-col">
                                    <Progress value={req.progress} className="h-2" />
                                    <span className="text-xs text-muted-foreground text-right">{Math.round(req.progress)}%</span>
                                </div>
                                ) : <span className="text-xs text-muted-foreground">N/A</span> }
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                                <Button variant="default" size="sm" onClick={() => setSelectedRequisition(req)}>
                                    <Eye className="mr-2 h-4 w-4"/>
                                    Ver e Atender Itens
                                </Button>
                                {isAdmin && (
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="destructive" size="icon" disabled={isProcessing === req.docId}>
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
                                                <AlertDialogAction onClick={() => handleDeleteRequisition(req.docId)}>
                                                    Sim, Excluir
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
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
                        <CardTitle>Ordens de Compra Aprovadas</CardTitle>
                        <CardDescription>Gerencie as OCs aprovadas, acompanhe entregas e finalize o processo.</CardDescription>
                         <div className="relative pt-4">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Pesquisar por OC ou fornecedor..."
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
                                    <TableRow><TableCell colSpan={6} className="h-24 text-center">Nenhuma Ordem de Compra aprovada encontrada.</TableCell></TableRow>
                                )}
                                 {!isLoading && filteredOCs.map(oc => (
                                    <TableRow key={oc.docId}>
                                        <TableCell className="font-mono">{oc.protocol}</TableCell>
                                        <TableCell>{oc.quotations?.[oc.selectedQuotationIndex!]?.supplierName || 'N/A'}</TableCell>
                                        <TableCell className="font-medium">{oc.totalValue?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                                        <TableCell>{format(new Date(oc.createdAt), 'dd/MM/yyyy')}</TableCell>
                                        <TableCell><Badge variant={getStatusVariant(oc.status)}>{oc.status}</Badge></TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="outline" size="sm" onClick={() => setSelectedRequisition(oc)}>
                                                <Eye className="mr-2 h-4 w-4" />
                                                Detalhes
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                 ))}
                            </TableBody>
                       </Table>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
      </div>

      {selectedRequisition && (
        <PurchaseRequisitionDetailsDialog
          requisition={selectedRequisition}
          isOpen={!!selectedRequisition}
          onClose={() => setSelectedRequisition(null)}
          onActionSuccess={handleSuccess}
        />
      )}
    </>
  );
};

export default ControleComprasPage;
