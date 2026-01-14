'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, orderBy, where, doc, getDocs, documentId, deleteDoc, writeBatch } from 'firebase/firestore';
import type { PurchaseRequisition, CostCenter, Employee, PurchaseRequisitionItem } from '@/lib/types';
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
import { Loader2, Search, Eye, Edit, AlertCircle, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import PurchaseRequisitionDetailsDialog from '@/components/PurchaseRequisitionDetailsDialog';
import { useQueryClient } from '@tanstack/react-query';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import ReviewRequisitionDialog from './ReviewRequisitionDialog';
import { cn } from '@/lib/utils';


type RequisitionWithProgress = WithDocId<PurchaseRequisition> & {
    progress: number;
    totalItems: number;
};

const getStatusVariant = (status: PurchaseRequisition['status']) => {
  const variants: { [key in PurchaseRequisition['status']]: 'default' | 'warning' | 'destructive' | 'secondary' | 'success' } = {
    'Aberta': 'secondary',
    'Em Cotação': 'warning',
    'Em Aprovação': 'default',
    'Aprovada': 'success',
    'Recusada': 'destructive',
    'Concluída': 'secondary',
    'Parcialmente Atendida': 'warning',
    'Totalmente Atendida': 'success',
    'Cancelada': 'destructive',
    'Aguardando Entrega': 'default',
    'Em Revisão': 'warning',
    'Pronta para OC': 'success',
    'Em Revisão Comprador': 'warning',
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

export default function MyRequisitionsTable() {
  const firestore = useFirestore();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequisition, setSelectedRequisition] = useState<WithDocId<PurchaseRequisition> | null>(null);
  const [requisitionToReview, setRequisitionToReview] = useState<WithDocId<PurchaseRequisition> | null>(null);
  const [requisitionsWithProgress, setRequisitionsWithProgress] = useState<RequisitionWithProgress[]>([]);
  const [isProcessingDelete, setIsProcessingDelete] = useState<string | null>(null);

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'employees', user.uid) : null),
    [firestore, user]
  );
  const { data: employeeData, isLoading: isEmployeeLoading } = useDoc<Employee>(userDocRef);

  const canViewAll = useMemo(() => {
    if (!employeeData) return false;
    return employeeData.accessLevel === 'Admin' || (employeeData.permissions?.compras ?? false);
  }, [employeeData]);

  const isAdmin = useMemo(() => employeeData?.accessLevel === 'Admin', [employeeData]);

  const queryKey = ['myPurchaseRequisitions', canViewAll, user?.uid];

  const requisitionsQuery = useMemoFirebase(() => {
    if (!firestore || !user || isEmployeeLoading) return null;
    
    if (canViewAll) {
        return query(collection(firestore, 'purchase_requisitions'), orderBy('createdAt', 'desc'));
    } else {
        return query(
            collection(firestore, 'purchase_requisitions'),
            where('requesterId', '==', user.uid),
            orderBy('createdAt', 'desc')
        );
    }
  }, [firestore, user, canViewAll, isEmployeeLoading]);
  
  const { data: requisitions, isLoading: isLoadingRequisitions, error: requisitionsError } = useCollection<WithDocId<PurchaseRequisition>>(requisitionsQuery, {
      queryKey,
      enabled: !isEmployeeLoading && !!user,
  });
  
  useEffect(() => {
    if (!requisitions || !firestore) return;
    
    const fetchProgress = async () => {
      const enrichedReqs: RequisitionWithProgress[] = [];
      for (const req of requisitions) {
        if (req.type === 'Ordem de Compra') {
            enrichedReqs.push({ ...req, progress: 0, totalItems: 0 });
            continue;
        }
        const itemsRef = collection(firestore, 'purchase_requisitions', req.docId, 'items');
        const itemsSnapshot = await getDocs(itemsRef);
        const totalItems = itemsSnapshot.size;
        let attendedItems = 0;
        
        itemsSnapshot.forEach(doc => {
          const item = doc.data() as PurchaseRequisitionItem;
          if (['Recebido', 'Cancelado'].includes(item.status)) {
            attendedItems++;
          }
        });
        
        const progress = totalItems > 0 ? (attendedItems / totalItems) * 100 : 0;
        enrichedReqs.push({ ...req, progress, totalItems });
      }
      setRequisitionsWithProgress(enrichedReqs);
    };

    fetchProgress();
  }, [requisitions, firestore]);

  const costCenterIds = useMemo(() => {
    if (!requisitions) return [];
    return [...new Set(requisitions.map(r => r.costCenterId))];
  }, [requisitions]);

  const costCentersQuery = useMemoFirebase(() => {
      if (!firestore || costCenterIds.length === 0) return null;
      return query(collection(firestore, 'cost_centers'), where(documentId(), 'in', costCenterIds));
  }, [firestore, costCenterIds]);
  const { data: costCenters, isLoading: isLoadingCostCenters } = useCollection<WithDocId<CostCenter>>(costCentersQuery, {
      queryKey: ['costCentersForMyReqs', costCenterIds.join(',')],
      enabled: costCenterIds.length > 0,
  });
  
  const costCenterMap = useMemo(() => {
      if (!costCenters) return new Map<string, string>();
      return new Map(costCenters.map(cc => [cc.docId, `${cc.code} - ${cc.description}`]));
  }, [costCenters]);


  const filteredRequisitions = useMemo(() => {
    if (!requisitionsWithProgress) return [];
    if (!searchTerm) return requisitionsWithProgress;
    const lowercasedTerm = searchTerm.toLowerCase();
    return requisitionsWithProgress.filter(req => 
        (req.protocol && req.protocol.toLowerCase().includes(lowercasedTerm)) ||
        req.status.toLowerCase().includes(lowercasedTerm) ||
        (costCenterMap.get(req.costCenterId) || '').toLowerCase().includes(lowercasedTerm)
    );
  }, [requisitionsWithProgress, searchTerm, costCenterMap]);

  const handleReviewSuccess = () => {
    setRequisitionToReview(null);
    queryClient.invalidateQueries({ queryKey });
  }

  const handleDeleteRequisition = async (requisitionId: string) => {
      if (!firestore) return;
      setIsProcessingDelete(requisitionId);
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
          toast({ title: 'Sucesso', description: `Requisição e seus itens foram excluídos.` });
          
          queryClient.invalidateQueries({ queryKey });

      } catch (err) {
          console.error("Erro ao excluir requisição:", err);
          toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível excluir o documento.' });
      } finally {
          setIsProcessingDelete(null);
      }
  }

  const isLoading = isLoadingRequisitions || isLoadingCostCenters || isEmployeeLoading;

  return (
    <>
      <TooltipProvider>
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Histórico de Solicitações</CardTitle>
            <CardDescription>
              Acompanhe o status e os detalhes de suas requisições de compra.
            </CardDescription>
            <div className="relative pt-4">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por protocolo, status..."
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
                  <TableHead>Protocolo</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[20%]">Atendimento</TableHead>
                  <TableHead>Centro de Custo</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                )}
                {requisitionsError && (
                  <TableRow><TableCell colSpan={7} className="h-24 text-center text-destructive">{requisitionsError.message}</TableCell></TableRow>
                )}
                {!isLoading && filteredRequisitions.length === 0 && (
                   <TableRow><TableCell colSpan={7} className="h-24 text-center">Nenhuma requisição encontrada.</TableCell></TableRow>
                )}
                {!isLoading && filteredRequisitions.map(req => {
                  const showReason = (req.status === 'Recusada' || req.status === 'Em Revisão') && req.rejectionReason;
                  return (
                    <TableRow key={req.docId} className={cn(req.status === 'Em Revisão' && 'bg-yellow-50 dark:bg-yellow-900/20')}>
                      <TableCell className="font-mono">
                        <p>{req.protocol || req.docId.substring(0, 8)}</p>
                        {req.originalRequisitionProtocol && <p className="text-xs text-muted-foreground">Origem: {req.originalRequisitionProtocol}</p>}
                      </TableCell>
                      <TableCell>{format(new Date(req.createdAt), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>
                         <div className="flex items-center gap-2">
                           <Badge variant={getStatusVariant(req.status)}>{req.status}</Badge>
                           {showReason && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help">
                                    <AlertCircle className="h-4 w-4 text-orange-500" />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{req.rejectionReason}</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                         </div>
                      </TableCell>
                      <TableCell>
                        {req.type === 'Solicitação de Compra' && req.totalItems > 0 ? (
                           <div className="flex flex-col">
                             <Progress value={req.progress} className="h-2" />
                             <span className="text-xs text-muted-foreground text-right">{Math.round(req.progress)}%</span>
                           </div>
                        ) : <span className="text-xs text-muted-foreground">N/A</span> }
                      </TableCell>
                      <TableCell>{costCenterMap.get(req.costCenterId) || req.costCenterId}</TableCell>
                      <TableCell><Badge variant={getPriorityVariant(req.priority)}>{req.priority}</Badge></TableCell>
                      <TableCell className="text-right space-x-2">
                       {req.status === 'Em Revisão' && (
                        <Button variant="secondary" size="sm" onClick={() => setRequisitionToReview(req)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Revisar
                        </Button>
                       )}
                      <Button variant="outline" size="sm" onClick={() => setSelectedRequisition(req)}>
                         <Eye className="mr-2 h-4 w-4" />
                         Ver Itens
                      </Button>
                       {isAdmin && req.type === 'Solicitação de Compra' && (
                          <AlertDialog>
                              <AlertDialogTrigger asChild>
                                  <Button variant="destructive" size="icon" disabled={isProcessingDelete === req.docId} title="Excluir Requisição">
                                      {isProcessingDelete === req.docId ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4" />}
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
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TooltipProvider>

      {selectedRequisition && (
          <PurchaseRequisitionDetailsDialog
            requisition={selectedRequisition}
            isOpen={!!selectedRequisition}
            onClose={() => setSelectedRequisition(null)}
            isRequesterView={true}
          />
      )}
      
      {requisitionToReview && (
        <ReviewRequisitionDialog
            requisition={requisitionToReview}
            isOpen={!!requisitionToReview}
            onClose={() => setRequisitionToReview(null)}
            onSuccess={handleReviewSuccess}
        />
      )}
    </>
  );
};
